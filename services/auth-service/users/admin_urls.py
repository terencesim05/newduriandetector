from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .admin_views import AdminViewSet

router = DefaultRouter()
router.register(r'', AdminViewSet, basename='admin')

urlpatterns = [
    path('', include(router.urls)),
]
