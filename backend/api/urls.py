from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

from api.views import (
    SignupView,
    LoginView,
    MeView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    ListingViewSet,
    TransactionViewSet,
    MessageViewSet,
    CarbonImpactView,
    ClassifyView,
    PaystackInitializeView,
    PaystackVerifyView,
    PaystackWebhookView,
    MediaUploadView,
    HealthView,
    DisputeViewSet,
)

router = DefaultRouter()
router.register(r'listings', ListingViewSet, basename='listing')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'disputes', DisputeViewSet, basename='dispute')

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    # OpenAPI 3.0 Schema and Swagger Documentation
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Auth endpoints
    path('auth/signup/', SignupView.as_view(), name='auth-signup'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path('auth/password-reset/', PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path('auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),

    # Feature endpoints
    path('impact/', CarbonImpactView.as_view(), name='carbon-impact'),
    path('classify/', ClassifyView.as_view(), name='ai-classify'),
    path('media/upload/', MediaUploadView.as_view(), name='media-upload'),
    path('pay/initialize/', PaystackInitializeView.as_view(), name='paystack-initialize'),
    path('pay/verify/', PaystackVerifyView.as_view(), name='paystack-verify'),
    path('pay/webhook/', PaystackWebhookView.as_view(), name='paystack-webhook'),

    # ViewSet routes
    path('', include(router.urls)),
]
