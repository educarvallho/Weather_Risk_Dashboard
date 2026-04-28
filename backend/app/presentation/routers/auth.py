import logging
from fastapi import APIRouter, Depends, HTTPException, status

logger = logging.getLogger(__name__)
from app.domain.exceptions import InvalidCredentialsException, InactiveUserException
from app.infrastructure.database.repositories.user_repository import UserRepository
from app.infrastructure.security.jwt_handler import JWTHandler
from app.infrastructure.security.password_hasher import PasswordHasher
from app.presentation.dependencies import get_user_repository, get_jwt_handler, get_password_hasher, get_current_user
from app.presentation.schemas.auth_schemas import LoginRequest, LoginResponse, UserOut
from app.use_cases.auth.login_use_case import LoginUseCase
from app.domain.entities.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    body: LoginRequest,
    user_repo: UserRepository = Depends(get_user_repository),
    jwt_handler: JWTHandler = Depends(get_jwt_handler),
    password_hasher: PasswordHasher = Depends(get_password_hasher),
):
    use_case = LoginUseCase(user_repo, jwt_handler, password_hasher)
    try:
        result = use_case.execute(body.email, body.password)
        user = result["user"]
        logger.info("login_success email=%s role=%s", user.email, user.role)
        return LoginResponse(
            access_token=result["access_token"],
            token_type="bearer",
            user=UserOut(id=str(user.id), email=user.email, full_name=user.full_name, role=user.role, is_active=user.is_active),
        )
    except InvalidCredentialsException:
        logger.warning("login_failed email=%s reason=invalid_credentials", body.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha inválidos")
    except InactiveUserException:
        logger.warning("login_failed email=%s reason=inactive_account", body.email)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta desativada")


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(id=str(current_user.id), email=current_user.email, full_name=current_user.full_name, role=current_user.role, is_active=current_user.is_active)
