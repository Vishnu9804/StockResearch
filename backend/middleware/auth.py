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

# PyJWKClient automatically downloads and caches the public keys from Supabase
jwks_url = f"{settings.SUPABASE_URL}/auth/v1/jwks"
jwks_client = PyJWKClient(jwks_url)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AuthenticatedUser:
    token = credentials.credentials
    try:
        # 1. Dynamically fetch the public key matching this token from Supabase
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # 2. Decode using the public key and allow the new ES256 algorithm
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "HS256"],
            audience="authenticated"
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
        # This will print the exact reason to your terminal if it fails again
        print(f"JWT VERIFICATION FAILED: {str(e)}") 
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cryptographic authentication token.",
        )