import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.config import settings
from pydantic import BaseModel

security = HTTPBearer()

class AuthenticatedUser(BaseModel):
    id: str
    email: str
    role: str

# CORRECTED: Point to the official Supabase well-known JWKS JSON file
jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"

# Inject the anon key into the headers to bypass the Supabase firewall
jwks_client = PyJWKClient(
    jwks_url,
    headers={"apikey": settings.SUPABASE_ANON_KEY}
)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AuthenticatedUser:
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        
        if alg == "HS256":
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
        else:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                options={"verify_aud": False}
            )
        
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role", "authenticated")
        
        if not user_id or not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload is missing crucial user identifiers.",
            )
            
        return AuthenticatedUser(id=user_id, email=email, role=role)
        
    except jwt.ExpiredSignatureError:
        print("JWT ERROR: The token has expired.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again.",
        )
    except Exception as e:
        print(f"JWT VERIFICATION FAILED: {str(e)}") 
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cryptographic authentication token.",
        )