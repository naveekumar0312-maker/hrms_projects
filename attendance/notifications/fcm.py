import logging

import firebase_admin
from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError

from .models import WebPushDevice

logger = logging.getLogger(__name__)


def get_firebase_app():
    try:
        return firebase_admin.get_app()
    except ValueError:
        from pathlib import Path
        from firebase_admin import credentials

        credential_path = Path(
            "/var/www/attendance/secrets/firebase-service-account.json"
        )
        if not credential_path.is_file():
            raise FileNotFoundError(
                f"Firebase service account file not found: {credential_path}"
            )

        credential = credentials.Certificate(str(credential_path))
        return firebase_admin.initialize_app(
            credential,
            {"projectId": "attendance-management-6a7a6"},
        )



def send_web_push(user, title, body, url=None, event=None):
    devices = WebPushDevice.objects.filter(
        user=user,
        is_active=True,
    )

    sent = 0

    for device in devices:
        try:
            target_url = url or "https://attendance.vibhutravelhub.com/"

            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data={
                    "url": target_url,
                    **({"event": event} if event else {}),
                },
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        title=title,
                        body=body,
                        icon="/favicon.ico",
                    ),
                    fcm_options=messaging.WebpushFCMOptions(
                        link=target_url,
                    ),
                ),
                token=device.token,
            )

            messaging.send(
                message,
                app=get_firebase_app(),
            )
            sent += 1

        except FirebaseError as exc:
            logger.warning(
                "FCM send failed for user=%s device=%s: %s",
                user.pk,
                device.pk,
                exc,
            )

            error_code = getattr(exc, "code", None)

            if error_code in (
                "UNREGISTERED",
                "registration-token-not-registered",
            ):
                device.delete()

        except Exception:
            logger.exception(
                "Unexpected FCM error for user=%s device=%s",
                user.pk,
                device.pk,
            )

    return sent
