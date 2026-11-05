import os
from django.core.files.storage import FileSystemStorage


class PrivateDocumentStorage(FileSystemStorage):
    def __init__(self, *args, **kwargs):
        super().__init__(
            location="/var/lib/attendance-private-documents",
            base_url=None,
            *args,
            **kwargs,
        )
