"""Shared ingestion lease primitives used by the backend and scraper child."""

from datetime import datetime, timedelta, timezone
import threading
import uuid

from pymongo import ReturnDocument


CONTROL_ID = "cluster-lifecycle"


class IngestionLeaseLost(RuntimeError):
    pass


def acquire_ingestion_lease(control, owner=None, lease_seconds=120):
    owner = owner or str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    control.update_one(
        {"_id": CONTROL_ID},
        {"$setOnInsert": {"activeGenerationId": None, "fencingToken": 0}},
        upsert=True,
    )
    lease = control.find_one_and_update(
        {
            "_id": CONTROL_ID,
            "$or": [
                {"leaseExpiresAt": {"$exists": False}},
                {"leaseExpiresAt": None},
                {"leaseExpiresAt": {"$lte": now}},
            ],
        },
        {
            "$inc": {"fencingToken": 1},
            "$set": {
                "leaseOwner": owner, "leaseExpiresAt": now + timedelta(seconds=lease_seconds),
                "leasePurpose": "INGESTION", "activeIngestJobId": None,
            },
        },
        upsert=False,
        return_document=ReturnDocument.AFTER,
    )
    if not lease or lease.get("leaseOwner") != owner:
        return None
    return {"owner": owner, "fencingToken": lease["fencingToken"]}


def renew_ingestion_lease(control, owner, fencing_token, job_id, lease_seconds):
    now = datetime.now(timezone.utc)
    result = control.update_one(
        {
            "_id": CONTROL_ID,
            "leaseOwner": owner,
            "fencingToken": fencing_token,
            "activeIngestJobId": str(job_id) if job_id is not None else None,
            "leaseExpiresAt": {"$gt": now},
        },
        {"$set": {"leaseExpiresAt": now + timedelta(seconds=lease_seconds)}},
    )
    if result.matched_count != 1:
        raise IngestionLeaseLost("Ingestion lease expired or was superseded")


def assert_ingestion_lease(control, owner, fencing_token, job_id):
    now = datetime.now(timezone.utc)
    if not control.find_one({
        "_id": CONTROL_ID,
        "leaseOwner": owner,
        "fencingToken": fencing_token,
        "activeIngestJobId": str(job_id) if job_id is not None else None,
        "leaseExpiresAt": {"$gt": now},
    }):
        raise IngestionLeaseLost("Ingestion lease missing or superseded")


def transition_owned_job(control, jobs, job_id, owner, fencing_token, update, expected_status="running"):
    now = datetime.now(timezone.utc)
    control_filter = {
        "_id": CONTROL_ID,
        "leaseOwner": owner,
        "fencingToken": fencing_token,
        "activeIngestJobId": str(job_id) if job_id is not None else None,
        "leaseExpiresAt": {"$gt": now},
    }
    if update.get("status") == "completed" and update.get("clusterGenerationId"):
        control_filter["activeGenerationId"] = update["clusterGenerationId"]
    lease_transition = control.update_one(control_filter, {"$set": {
        "lastIngestJobTransition": {
            "jobId": str(job_id) if job_id is not None else None,
            "fencingToken": fencing_token,
            "status": update.get("status"),
            "at": now,
        },
    }})
    if lease_transition.matched_count != 1:
        return False
    result = jobs.update_one({
        "_id": job_id,
        "status": expected_status,
        "leaseOwner": owner,
        "fencingToken": fencing_token,
    }, {"$set": update})
    return result.matched_count == 1


class IngestionLeaseHeartbeat:
    def __init__(self, control, owner, fencing_token, job_id, lease_seconds=120):
        self.control = control
        self.owner = owner
        self.fencing_token = fencing_token
        self.job_id = job_id
        self.lease_seconds = lease_seconds
        self._stop = threading.Event()
        self._lost = threading.Event()
        self._thread = threading.Thread(target=self._run, name="ingestion-lease-heartbeat", daemon=True)

    def start(self):
        assert_ingestion_lease(self.control, self.owner, self.fencing_token, self.job_id)
        self._thread.start()

    def _run(self):
        interval = max(2, self.lease_seconds / 3)
        while not self._stop.wait(interval):
            try:
                renew_ingestion_lease(self.control, self.owner, self.fencing_token, self.job_id, self.lease_seconds)
            except Exception:
                self._lost.set()
                return

    def assert_valid(self):
        if self._lost.is_set():
            raise IngestionLeaseLost("Ingestion lease heartbeat lost ownership")
        assert_ingestion_lease(self.control, self.owner, self.fencing_token, self.job_id)

    def stop(self):
        self._stop.set()
        if self._thread.is_alive():
            self._thread.join(timeout=2)
