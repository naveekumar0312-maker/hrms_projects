import hashlib

from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WebPushDevice


class WebPushTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("token")

        if not isinstance(token, str) or not token.strip():
            return Response(
                {"detail": "A valid token is required."},
                status=400,
            )

        token = token.strip()
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

        with transaction.atomic():
            device, created = WebPushDevice.objects.update_or_create(
                token_hash=token_hash,
                defaults={
                    "user": request.user,
                    "token": token,
                    "is_active": True,
                },
            )

        return Response({"registered": True}, status=200)

    def delete(self, request):
        token = request.data.get("token")

        if not isinstance(token, str) or not token.strip():
            return Response(
                {"detail": "A valid token is required."},
                status=400,
            )

        token_hash = hashlib.sha256(
            token.strip().encode("utf-8")
        ).hexdigest()

        WebPushDevice.objects.filter(
            user=request.user,
            token_hash=token_hash,
        ).delete()

        return Response({"deleted": True}, status=200)
