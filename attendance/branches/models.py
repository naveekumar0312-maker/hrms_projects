from django.db import models
from companies.models import Company

class Branch(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='branches', null=True, blank=True)
    branch_name = models.CharField(max_length=255)
    office_address = models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    allowed_radius = models.IntegerField(default=100) # in meters
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.branch_name
