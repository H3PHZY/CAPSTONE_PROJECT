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
    ListingViewSet,
    TransactionViewSet,
    MessageViewSet,
    CarbonImpactView,
    ClassifyView,
    PaystackInitializeView,
    PaystackVerifyView,
)

router = DefaultRouter()
router.register(r'listings', ListingViewSet, basename='listing')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'messages', MessageViewSet, basename='message')

urlpatterns = [
    # OpenAPI 3.0 Schema and Swagger Documentation
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Auth endpoints
    path('auth/signup/', SignupView.as_view(), name='auth-signup'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/me/', MeView.as_view(), name='auth-me'),

    # Feature endpoints
    path('impact/', CarbonImpactView.as_view(), name='carbon-impact'),
    path('classify/', ClassifyView.as_view(), name='ai-classify'),
    path('pay/initialize/', PaystackInitializeView.as_view(), name='paystack-initialize'),
    path('pay/verify/', PaystackVerifyView.as_view(), name='paystack-verify'),

    # ViewSet routes
    path('', include(router.urls)),
]

