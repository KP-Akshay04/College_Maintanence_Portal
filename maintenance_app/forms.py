from django import forms
from .models import MaintenanceRequest
class MaintenanceRequestForm(forms.ModelForm):
    class Meta:
        model = MaintenanceRequest
        fields = ['branch','title','lab_name','description']
        widgets = {'description': forms.Textarea(attrs={'rows':4}),}
