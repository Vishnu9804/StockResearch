from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import logging
import time
from services.finedge_service import execute_proxy_request

router = APIRouter(prefix="/api/screener", tags=["screener"])
logger = logging.getLogger("screener")

class RunScreenerBody(BaseModel):
    query: str
    page: int = 1
    limit: int = 25

def _req_id(request: Request) -> str:
    return request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}")

@router.post("/run")
async def run_screener(body: RunScreenerBody, request: Request):
    try:
        rid = _req_id(request)
        
        # Directly proxy the query to FinEdge API
        data = await execute_proxy_request(
            "POST", 
            "screener/run", 
            {}, 
            {"query": body.query, "page": body.page, "limit": body.limit}, 
            rid
        )
        
        return data if data else {"success": True, "results": [], "total": 0}

    except Exception as e:
        logger.error(f"[Screener] Proxy query failed: {e}")
        raise HTTPException(status_code=500, detail={"error": True, "message": "Failed to run screener query."})