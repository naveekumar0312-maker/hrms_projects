from django.db import models
from django.utils.text import slugify


class Company(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, null=True, blank=True, db_index=True)
    code = models.CharField(max_length=50, unique=True, null=True, blank=True)
    address = models.TextField(null=True, blank=True)

    logo = models.ImageField(
        upload_to="company_logos/",
        null=True,
        blank=True,
    )
    login_background = models.ImageField(upload_to="company_login_backgrounds/", null=True, blank=True)
    primary_color = models.CharField(
        max_length=7,
        default="#E56717",
    )
    tagline = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    left_panel_heading = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )
    left_panel_content = models.TextField(
        blank=True,
        default="",
    )
    footer_message = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )
    left_panel_color = models.CharField(
        max_length=7,
        default="#315C55",
    )
    login_button_color = models.CharField(
        max_length=7,
        default="#2563EB",
    )

    branding_configured = models.BooleanField(default=False, db_index=True)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            base_slug = slugify(self.name) or "company"
            slug = base_slug
            counter = 1
            while Company.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
