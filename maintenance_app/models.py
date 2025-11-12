from django.db import models
from django.contrib.auth.models import User
import uuid
from django.db import models
from django.utils import timezone
import json


class QuotationBatch(models.Model):
    """Batch of requests grouped by Principal to send for quotation."""
    requests = models.TextField(help_text="JSON list of request IDs")
    token = models.CharField(max_length=64, unique=True, default=uuid.uuid4().hex)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"QuotationBatch #{self.id}"

    def get_request_list(self):
        try:
            return json.loads(self.requests)
        except json.JSONDecodeError:
            return []


class QuotationResponse(models.Model):
    """Response submitted by a company/vendor."""
    batch = models.ForeignKey(QuotationBatch, on_delete=models.CASCADE, related_name='responses')
    company_name = models.CharField(max_length=255)
    email = models.EmailField()
    submitted_at = models.DateTimeField(default=timezone.now)
    total_amount = models.FloatField(default=0)
    selected = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.company_name} (Batch #{self.batch.id})"


class QuotationItem(models.Model):
    """Each item’s quotation price under a response."""
    quotation = models.ForeignKey(QuotationResponse, on_delete=models.CASCADE, related_name='items')
    request = models.ForeignKey('MaintenanceRequest', on_delete=models.CASCADE)
    device = models.CharField(max_length=255)
    brand = models.CharField(max_length=255, blank=True, null=True)
    quantity = models.IntegerField(default=1)
    price = models.FloatField(default=0)
    subtotal = models.FloatField(default=0)

    def save(self, *args, **kwargs):
        self.subtotal = self.price * self.quantity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.device} - {self.price}"

class Profile(models.Model):
    ROLE_CHOICES = (('HOD','Head of Department'),('ADMIN','Principal/Admin'))
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='HOD')
    branch = models.CharField(max_length=100, blank=True, null=True)
    def __str__(self):
        return f"{self.user.username} - {self.role}"
class MaintenanceRequest(models.Model):
    STATUS_CHOICES = [('Pending','Pending'),('Approved','Approved'),('Rejected','Rejected'),('Completed','Completed'),]
    hod = models.ForeignKey(User, on_delete=models.CASCADE)
    branch = models.CharField(max_length=100)
    title = models.CharField(max_length=150)
    lab_name = models.CharField(max_length=100)
    description = models.TextField()
    date_submitted = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    admin_remark = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    selected_items = models.TextField(blank=True, null=True)  
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    
    def __str__(self):
        return f"{self.title} ({self.branch}) - {self.status}"
