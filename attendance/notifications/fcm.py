import logging
import requests

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
            # Fallback for local development
            local_path = Path(__file__).resolve().parent.parent / "secrets" / "firebase-service-account.json"
            if local_path.is_file():
                credential_path = local_path
            else:
                raise FileNotFoundError(
                    f"Firebase service account file not found: {credential_path}"
                )

        credential = credentials.Certificate(str(credential_path))
        return firebase_admin.initialize_app(
            credential,
            {"projectId": "attendance-management-6a7a6"},
        )


def _send_expo_push(token, title, body, event=None, url=None):
    """Send push notification to an Expo push token (ExponentPushToken[...] or ExpoPushToken[...])."""
    try:
        payload = {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
            "channelId": "hrms-notifications-v1",
            "data": {
                "url": url or "/",
                **({"event": event} if event else {}),
            },
        }
        resp = requests.post(
            "https://exp.host/--/api/v2/push/send",
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            json=payload,
            timeout=8,
        )
        if resp.status_code == 200:
            res_data = resp.json().get("data", {})
            if isinstance(res_data, dict) and res_data.get("status") == "error":
                details = res_data.get("details", {})
                if details.get("error") == "DeviceNotRegistered":
                    return "UNREGISTERED"
            return True
        logger.warning("Expo push failed with status %s: %s", resp.status_code, resp.text)
        return False
    except Exception as exc:
        logger.warning("Expo push exception for token %s: %s", token, exc)
        return False


def send_web_push(user, title, body, url=None, event=None):
    devices = WebPushDevice.objects.filter(
        user=user,
        is_active=True,
    )

    sent = 0

    for device in devices:
        token = device.token

        # Check if this is an Expo Push Token from the Mobile App
        if token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken["):
            expo_res = _send_expo_push(token, title, body, event=event, url=url)
            if expo_res is True:
                sent += 1
            elif expo_res == "UNREGISTERED":
                device.delete()
            continue

        # Otherwise send via Firebase Admin FCM (Web Push or Direct FCM)
        try:
            target_url = url or "https://hrms.yaazh360digitech.in/"

            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data={
                    "url": target_url,
                    **({"event": event} if event else {}),
                },
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        channel_id="hrms-notifications-v1",
                        priority="high",
                        default_sound=True,
                        default_vibrate_timings=True,
                    ),
                ),
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
                token=token,
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
