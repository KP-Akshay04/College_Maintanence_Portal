
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from .models import MaintenanceRequest, Profile
from .forms import MaintenanceRequestForm
from django.contrib.auth.models import User
from django.contrib.auth.views import LoginView
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import logout
import json,uuid
from django.core.mail import send_mail
from django.conf import settings
from django.core.mail import EmailMessage
import tempfile
import os
from weasyprint import HTML
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.urls import reverse
from django.views.decorators.cache import never_cache
import uuid, json
from django.shortcuts import render, redirect, get_object_or_404
from .models import MaintenanceRequest, QuotationBatch, QuotationResponse, QuotationItem
from django.http import JsonResponse
from django.db.models import Sum, Q, Value, F, FloatField
from django.db.models.functions import Coalesce


def is_admin(user): 
    try:
        # Allow both ADMIN and PRINCIPAL roles
        return user.profile.role in ['ADMIN', 'PRINCIPAL']
    except Exception:
        # Fallback for users without profile (like superuser)
        return user.is_superuser


@login_required
@user_passes_test(is_admin)
def generate_quotation_link(request):
    """
    AJAX endpoint: receives POST with selected_requests[] and returns JSON: {success, link/message}
    """
    if request.method == "POST" and request.headers.get('x-requested-with') == 'XMLHttpRequest':
        selected_ids = request.POST.getlist('selected_requests[]') or request.POST.getlist('selected_requests')
        if not selected_ids:
            return JsonResponse({"success": False, "message": "Please select at least one request."})

        # create a quotation batch
        batch = QuotationBatch.objects.create(
            requests=json.dumps(selected_ids),
            token=uuid.uuid4().hex
        )

        # generate URL for vendor fill page (use quotation_fill with token)
        try:
           link = request.build_absolute_uri(reverse('quotation_fill', args=[batch.token]))
        except Exception as e:
           # Fallback if reverse fails
           link = request.build_absolute_uri(f"/quotation/fill/{batch.token}/")
        return JsonResponse({"success": True, "link": link})

    # If not AJAX or not POST:
    return JsonResponse({"success": False, "message": "Invalid request."})


def quotation_fill_view(request, token):
    """Vendor fills and submits quotation form."""
    batch = get_object_or_404(QuotationBatch, token=token)
    request_ids = batch.get_request_list()
    requests = MaintenanceRequest.objects.filter(id__in=request_ids)

    # Collect all maintenance request items
    items = []
    for req in requests:
        try:
            req_items = json.loads(req.selected_items)
            for i in req_items:
                items.append({
                    "request_id": req.id,
                    "request_title": req.title,
                    "device": i.get("device", ""),
                    "brand": i.get("brand", ""),
                    "quantity": i.get("quantity", 1),
                })
        except Exception:
            continue

    # Handle form submission
    if request.method == "POST":
        company_name = request.POST.get("company_name")
        email = request.POST.get("email")

        if not company_name or not email:
            messages.error(request, "Company name and email are required.")
            return render(request, "quotation_fill.html", {"items": items, "batch": batch})

        # Create a new quotation response
        quotation = QuotationResponse.objects.create(batch=batch, company_name=company_name, email=email)

        total = 0
        for item in items:
            try:
                price = float(request.POST.get(f"price_{item['request_id']}_{item['device']}", 0))
            except ValueError:
                price = 0

            subtotal = price * int(item["quantity"])
            total += subtotal

            QuotationItem.objects.create(
                quotation=quotation,
                request_id=item["request_id"],
                device=item["device"],
                brand=item["brand"],
                quantity=item["quantity"],
                price=price,
                subtotal=subtotal,
            )

        quotation.total_amount = total
        quotation.save()

        messages.success(request, "Your quotation has been submitted successfully!")
        return redirect(request.path)  # Stay on same page (shows success message)

    return render(request, "quotation_fill.html", {"items": items, "batch": batch})


# -------------------------------------------------------------------
# ✅ Principal: View all batches
# -------------------------------------------------------------------
@login_required
@user_passes_test(is_admin)
def principal_view_quotations(request):
    """List all quotation batches."""
    batches = QuotationBatch.objects.all().order_by("-created_at")
    return render(request, "quotation_list.html", {"batches": batches})


# -------------------------------------------------------------------
# ✅ Principal: View all quotations for a batch
# -------------------------------------------------------------------
@login_required
@user_passes_test(is_admin)
def principal_view_quotations_batch(request, batch_id):
    batch = get_object_or_404(QuotationBatch, id=batch_id)
    quotations = QuotationResponse.objects.filter(batch=batch).order_by("-submitted_at")

    return render(request, "quotation_batch_detail.html", {
        "batch": batch,
        "quotations": quotations,
    })

# -------------------------------------------------------------------
# ✅ Principal: Select a specific quotation
# -------------------------------------------------------------------
@login_required
@user_passes_test(is_admin)
def select_quotation(request, response_id):
    """Principal selects the best quotation."""
    response = get_object_or_404(QuotationResponse, id=response_id)
    QuotationResponse.objects.filter(batch=response.batch).update(selected=False)
    response.selected = True
    response.save()

    messages.success(request, f"{response.company_name}'s quotation has been selected successfully.")
    return redirect("principal_view_quotations_batch", batch_id=response.batch.id)

class CustomLoginView(LoginView):
    template_name = 'registration/login.html'  # Path confirmed

    def form_valid(self, form):
        """Called when valid form data has been POSTed."""
        # Log the user in
        response = super().form_valid(form)

        # Role-based redirect
        user = self.request.user
        if user.is_superuser or (hasattr(user, 'profile') and user.profile.role == 'PRINCIPAL'):
            return redirect('admin_dashboard')
        return redirect('hod_dashboard')

    def get(self, request, *args, **kwargs):
        """Redirect authenticated users away from the login page."""
        if request.user.is_authenticated:
            return redirect(self.get_success_url())
        return super().get(request, *args, **kwargs)

    def get_success_url(self):
        """Default success URL after login."""
        user = self.request.user
        if user.is_superuser or (hasattr(user, 'profile') and user.profile.role == 'PRINCIPAL'):
            return reverse('admin_dashboard')
        return reverse('hod_dashboard')
 


def home_redirect(request):
    if request.user.is_authenticated:
        try:
            if request.user.is_superuser:
                return redirect('admin_dashboard')
            elif hasattr(request.user, 'username') and request.user.username == 'prinipal':
                return redirect('admin_dashboard')
            else:
                return redirect('hod_dashboard')
        except Exception:
            return redirect('hod_dashboard')

    return render(request, 'homepage.html')


@never_cache
@login_required
def hod_dashboard(request):
    # Base queryset (only this HOD’s requests)
    requests = MaintenanceRequest.objects.filter(hod=request.user).order_by('-date_submitted')

    # Capture optional ?status= parameter
    status_filter = request.GET.get("status")

    if status_filter:
        requests = requests.filter(status=status_filter)

    # Summary counts for cards
    total = requests.count() if not status_filter else MaintenanceRequest.objects.filter(hod=request.user).count()
    pending = MaintenanceRequest.objects.filter(hod=request.user, status="Pending").count()
    approved = MaintenanceRequest.objects.filter(hod=request.user, status="Approved").count()
    rejected = MaintenanceRequest.objects.filter(hod=request.user, status="Rejected").count()

    context = {
        "requests": requests,
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "status_filter": status_filter,
    }

    return render(request, "hod_dashboard.html", context)

@login_required
def new_request(request):
    items = [
        {"device": "SSD", "brand": "Any", "size": "256GB", "price": 1750, "usage": "win-10", "remarks": "best and less price"},
        {"device": "RAM", "brand": "Any", "size": "8GB ddr3", "price": 1600, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Motherboard", "brand": "Any", "size": "G41-LGA 775 Socket", "price": 1800, "usage": "win-7", "remarks": "best and less price"},
        {"device": "Motherboard", "brand": "Any", "size": "H61-LGA 1155 Socket", "price": 2100, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Motherboard", "brand": "Any", "size": "H110-LGA 1151 Socket", "price": 2100, "usage": "win-11", "remarks": "best and less price"},
        {"device": "Processor", "brand": "i3 3rd gen", "size": "any", "price": 1200, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Processor", "brand": "Intel dual core", "size": "any", "price": 1000, "usage": "win-10", "remarks": "best and less price"},
        {"device": "SMPS", "brand": "Any", "size": "any", "price": 650, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Keyboard", "brand": "Any", "size": "any", "price": 700, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Mouse", "brand": "Any", "size": "any", "price": 400, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Keyboard-Mouse combo", "brand": "Any", "size": "any", "price": 1000, "usage": "win-10", "remarks": "best and less price"},
        {"device": "USB to PS2 Connector", "brand": "Any", "size": "any", "price": 650, "usage": "win-10", "remarks": "best and less price"},
        {"device": "USB to LAN Connector", "brand": "Any", "size": "any", "price": 650, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Monitor", "brand": "Any", "size": "any", "price": 5600, "usage": "win-11", "remarks": "best and less price"},
        {"device": "One Set (i3)", "brand": "G61 + H61", "size": "SSD 256GB + RAM 8GB", "price": 7200, "usage": "-", "remarks": "Souza's Price 7200"},
        {"device": "One Set (i5)", "brand": "Gh110", "size": "SSD 256GB + RAM 8GB ddr4", "price": 8800, "usage": "-", "remarks": "Souza's Price 8800"},
        {"device": "One Set (Dual core)", "brand": "G41", "size": "SSD 256GB + RAM 8GB", "price": 6500, "usage": "-", "remarks": "Souza's Price"},
    ]

    if request.method == 'POST':
        branch = request.POST.get('branch')
        title = request.POST.get('title')
        description = request.POST.get('description')
        selected_items = request.POST.get('selected_items')  
        total_amount = request.POST.get('total_amount')

        # Create the request
        mr = MaintenanceRequest(
            title=title,
            description=description,
            branch=branch,
            hod=request.user,
            selected_items=selected_items,
            total_amount=total_amount or 0
        )

        # Set branch if not provided
        try:
            if not mr.branch:
                mr.branch = request.user.profile.branch
        except Exception:
            pass

        mr.save()

        # ------------------- Send Email ------------------- #
        # Get admins and principals
        admins = User.objects.filter(is_superuser=True)
        principals = User.objects.filter(username__iexact='principal')
        recipients = list(admins) + list(principals)
        recipient_emails = [u.email for u in recipients if u.email]

        if recipient_emails:
            subject = f'New Maintenance Request Submitted: {mr.title}'
            link = f'http://yourdomain.com/request/{mr.pk}/'  # replace with your domain

            # Render HTML email template
            html_content = render_to_string('emails/new_request.html', {
                'req': mr,
                'user': request.user,
                'link': link
            })

            msg = EmailMultiAlternatives(subject, '', 'no-reply@yourdomain.com', recipient_emails)
            msg.attach_alternative(html_content, "text/html")
            msg.send()
        # -------------------------------------------------- #

        messages.success(request, 'Request submitted successfully.')
        return redirect('hod_dashboard')

    return render(request, 'new_request.html', {'items': items})

@login_required
def request_detail(request, pk):
    req = get_object_or_404(MaintenanceRequest, pk=pk)
    items = []

    if req.selected_items:
        try:
            items = json.loads(req.selected_items)
            # Handle double-encoded JSON if needed
            if isinstance(items, str):
                items = json.loads(items)

            # Compute subtotal
            for item in items:
                try:
                    price = float(item.get('price', 0))
                    quantity = int(item.get('quantity', 1))
                    item['subtotal'] = price * quantity
                except (ValueError, TypeError):
                    item['subtotal'] = 0

            print(items)  # 👈 Check console output

        except (json.JSONDecodeError, TypeError):
            items = []

    return render(request, 'request_detail.html', {
        'req': req,
        'items': items,
    })


@never_cache
@login_required
@user_passes_test(is_admin)
def admin_dashboard(request):
    status_filter = request.GET.get('status') or ''
    department_filter = request.GET.get('department') or ''

    requests_qs = MaintenanceRequest.objects.order_by('-date_submitted')

    # Apply filters
    if status_filter:
        requests_qs = requests_qs.filter(status=status_filter)

    if department_filter:
        requests_qs = requests_qs.filter(branch=department_filter)

    # Counts for cards
    total = MaintenanceRequest.objects.count()
    pending = MaintenanceRequest.objects.filter(status='Pending').count()
    approved = MaintenanceRequest.objects.filter(status='Approved').count()
    rejected = MaintenanceRequest.objects.filter(status='Rejected').count()

    # Distinct departments for dropdown (sorted)
    departments = list(MaintenanceRequest.objects.values_list('branch', flat=True).distinct().order_by('branch'))

    context = {
        'requests': requests_qs,
        'total': total,
        'pending': pending,
        'approved': approved,
        'rejected': rejected,
        'departments': departments,
        'status_filter': status_filter,
        'department_filter': department_filter,
    }
    return render(request, 'admin_dashboard.html', context)


@login_required
@user_passes_test(is_admin)
def approve_request(request, pk):
    """
    Approve a single maintenance request.
    - If AJAX (X-Requested-With), return JSON (success/new_status).
    - Otherwise behave as before (send email, pdf and redirect).
    """
    req = get_object_or_404(MaintenanceRequest, pk=pk)
    # update status and admin remark
    req.status = 'Approved'
    req.admin_remark = request.POST.get('admin_remark', 'Approved by admin')
    req.save()

    # Build items list safely
    items = []
    if req.selected_items:
        try:
            items = json.loads(req.selected_items)
            if isinstance(items, str):
                items = json.loads(items)
        except (json.JSONDecodeError, TypeError):
            items = []

    # Try to send email with PDF; if fails, continue but report in console
    try:
        hod_email = req.hod.email
        if hod_email:
            html_content = render_to_string('request_letter.html', {'request_obj': req, 'items': items})

            # Write PDF to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                HTML(string=html_content).write_pdf(temp_file.name)
                pdf_path = temp_file.name

            subject = f"Maintenance Request Approved: {req.title}"
            message = (
                f"Dear {req.hod.first_name or req.hod.username},\n\n"
                f"Your maintenance request titled '{req.title}' for branch {req.branch} "
                f"has been approved.\n\n"
                f"Total Amount: ₹{req.total_amount}\n\n"
                f"The detailed request letter (with equipment list) is attached as a PDF.\n\n"
                f"Thank you,\nAdmin Team"
            )

            email = EmailMessage(
                subject=subject,
                body=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[hod_email],
            )

            with open(pdf_path, 'rb') as f:
                email.attach('RequestLetter.pdf', f.read(), 'application/pdf')

            email.send(fail_silently=False)

            # Remove temp file
            try:
                os.remove(pdf_path)
            except OSError:
                pass
    except Exception as e:
        # log exception for debugging (print or logger)
        print("Error sending approval email/PDF:", e)

    # If AJAX, return JSON
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({"success": True, "new_status": "Approved"})

    # Non-AJAX: flash message and redirect
    messages.success(request, 'Request approved and letter (with equipment) sent as PDF.')
    return redirect('admin_dashboard')


@login_required
@user_passes_test(is_admin)
def reject_request(request, pk):
    """
    Reject a single maintenance request.
    - If AJAX, return JSON.
    - Otherwise behave as before and redirect.
    """
    req = get_object_or_404(MaintenanceRequest, pk=pk)
    req.status = 'Rejected'
    req.admin_remark = request.POST.get('admin_remark', 'Rejected by admin')
    req.save()

    # Try to send rejection email (no PDF required)
    try:
        hod_email = req.hod.email
        if hod_email:
            subject = f"Maintenance Request Rejected: {req.title}"
            message = (
                f"Dear {req.hod.first_name or req.hod.username},\n\n"
                f"Your maintenance request titled '{req.title}' for branch {req.branch} "
                f"has been rejected.\n\n"
                f"Admin Remark: {req.admin_remark}\n\n"
                f"Total Amount: ₹{req.total_amount}\n\n"
                f"Thank you,\nAdmin Team"
            )
            send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [hod_email], fail_silently=False)
    except Exception as e:
        print("Error sending rejection email:", e)

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({"success": True, "new_status": "Rejected"})

    messages.success(request, 'Request rejected and email notification sent.')
    return redirect('admin_dashboard')

@login_required
@user_passes_test(is_admin)
def edit_request(request, pk):
    req = get_object_or_404(MaintenanceRequest, pk=pk)

    # equipment list (same as new_request)
    items = [
        {"device": "SSD", "brand": "Any", "size": "256GB", "price": 1750, "usage": "win-10", "remarks": "best and less price"},
        {"device": "RAM", "brand": "Any", "size": "8GB ddr3", "price": 1600, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Motherboard", "brand": "Any", "size": "G41-LGA 775 Socket", "price": 1800, "usage": "win-7", "remarks": "best and less price"},
        {"device": "Motherboard", "brand": "Any", "size": "H61-LGA 1155 Socket", "price": 2100, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Motherboard", "brand": "Any", "size": "H110-LGA 1151 Socket", "price": 2100, "usage": "win-11", "remarks": "best and less price"},
        {"device": "Processor", "brand": "i3 3rd gen", "size": "any", "price": 1200, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Processor", "brand": "Intel dual core", "size": "any", "price": 1000, "usage": "win-10", "remarks": "best and less price"},
        {"device": "SMPS", "brand": "Any", "size": "any", "price": 650, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Keyboard", "brand": "Any", "size": "any", "price": 700, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Mouse", "brand": "Any", "size": "any", "price": 400, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Keyboard-Mouse combo", "brand": "Any", "size": "any", "price": 1000, "usage": "win-10", "remarks": "best and less price"},
        {"device": "USB to PS2 Connector", "brand": "Any", "size": "any", "price": 650, "usage": "win-10", "remarks": "best and less price"},
        {"device": "USB to LAN Connector", "brand": "Any", "size": "any", "price": 650, "usage": "win-10", "remarks": "best and less price"},
        {"device": "Monitor", "brand": "Any", "size": "any", "price": 5600, "usage": "win-11", "remarks": "best and less price"},
        {"device": "One Set (i3)", "brand": "G61 + H61", "size": "SSD 256GB + RAM 8GB", "price": 7200, "usage": "-", "remarks": "Souza's Price 7200"},
        {"device": "One Set (i5)", "brand": "Gh110", "size": "SSD 256GB + RAM 8GB ddr4", "price": 8800, "usage": "-", "remarks": "Souza's Price 8800"},
        {"device": "One Set (Dual core)", "brand": "G41", "size": "SSD 256GB + RAM 8GB", "price": 6500, "usage": "-", "remarks": "Souza's Price"},
    ]

    if request.method == 'POST':
        # Update basic fields
        req.branch = request.POST.get('branch', req.branch)
        req.title = request.POST.get('title', req.title)
        req.lab_name = request.POST.get('lab_name', req.lab_name)
        req.description = request.POST.get('description', req.description)

        # Handle selected items JSON
        sel_items = request.POST.get('selected_items', '')
        total_amount = request.POST.get('total_amount', '0')

        try:
            if sel_items:
                json.loads(sel_items)  # Validate JSON
                req.selected_items = sel_items
            else:
                req.selected_items = None
        except json.JSONDecodeError:
            messages.error(request, "Invalid equipment data. Items not saved.")
            return redirect('admin_dashboard')

        # Assign total
        try:
            req.total_amount = float(total_amount)
        except ValueError:
            req.total_amount = 0.0

        req.save()
        messages.success(request, "Request updated successfully.")
        return redirect('admin_dashboard')

    # For GET request → Preload selected items for display
    selected_data = {}
    if req.selected_items:
        try:
            selected_items = json.loads(req.selected_items)
            # Use a unique key to differentiate same devices (like multiple Motherboards)
            for item in selected_items:
                key = f"{item.get('device')}_{item.get('size')}"
                selected_data[key] = item.get('quantity', 0)
        except (json.JSONDecodeError, TypeError):
            selected_data = {}

    return render(request, 'edit_request.html', {
        'req': req,
        'items': items,
        'selected_data': selected_data,
    })

def user_logout(request):
    logout(request)
    return redirect('home_redirect') 

from django.shortcuts import render

from django.core.exceptions import FieldError
import decimal

# --- SAFE fallback for reports (paste in views.py) ---
import json
from django.contrib.auth.decorators import login_required, user_passes_test

@login_required
@user_passes_test(is_admin)
def approved_quotations_reports_view(request):
    """
    Render the reports page with approved maintenance requests and selected quotation totals.
    """
    approved_requests = (
        MaintenanceRequest.objects.filter(status='Approved')
        .annotate(
            approved_total=Coalesce(
                Sum(
                    'quotationitem__subtotal',
                    filter=Q(quotationitem__quotation__selected=True),
                    output_field=FloatField(),
                ),
                Value(0.0),
                output_field=FloatField(),
            )
        )
        .order_by('-date_submitted')
    )

    departments = list(
        MaintenanceRequest.objects.filter(status='Approved')
        .exclude(branch__isnull=True)
        .exclude(branch__exact='')
        .values_list('branch', flat=True)
        .distinct()
        .order_by('branch')
    )

    department_totals_qs = (
        QuotationItem.objects.filter(quotation__selected=True)
        .values(branch=F('request__branch'))
        .annotate(
            department_total=Coalesce(
                Sum('subtotal', output_field=FloatField()),
                Value(0.0),
                output_field=FloatField(),
            )
        )
        .order_by('branch')
    )

    department_totals = list(department_totals_qs)

    department_totals_raw = {}
    for item in department_totals:
        branch_key = item['branch'] or None
        department_totals_raw[branch_key] = float(item['department_total'] or 0)

    # Ensure every department appears with at least zero
    for branch in departments:
        department_totals_raw.setdefault(branch, 0.0)

    department_totals_output = [
        {'branch': branch, 'department_total': department_totals_raw.get(branch, 0.0)}
        for branch in departments
    ]

    # Include requests without a branch label, if present
    if None in department_totals_raw and None not in [item['branch'] for item in department_totals_output]:
        department_totals_output.append({'branch': None, 'department_total': department_totals_raw[None]})

    department_totals_map = {
        (branch if branch else 'Not specified'): total
        for branch, total in department_totals_raw.items()
    }

    grand_total = sum(department_totals_map.values())

    context = {
        'requests': approved_requests,
        'departments': departments,
        'department_totals': department_totals_output,
        'department_totals_json': json.dumps(department_totals_map),
        'grand_total': grand_total,
    }
    return render(request, 'reports.html', context)

@login_required
@user_passes_test(is_admin)
def reports_view(request):
    # alias to the safe view
    return approved_quotations_reports_view(request)
# --- end safe fallback ---



def department_list(request):
    return render(request, 'department_list.html')


def reports_page(request):
    return render(request, 'reports.html')
