from django.urls import path
from django.contrib.auth import views as auth_views
from maintenance_app.views import CustomLoginView

from . import views
urlpatterns = [ 
    path('accounts/login/', CustomLoginView.as_view(), name='login'),
    path('logout/', views.user_logout, name='logout'),
    path('', views.home_redirect, name='home_redirect'),
    path('hod/dashboard/', views.hod_dashboard, name='hod_dashboard'),
    path('hod/request/new/', views.new_request, name='new_request'),
    path('request/<int:pk>/', views.request_detail, name='request_detail'),
    path('admin-dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('request/<int:pk>/approve/', views.approve_request, name='approve_request'),
    path('request/<int:pk>/reject/', views.reject_request, name='reject_request'),
    path('request/<int:pk>/edit/',views.edit_request, name='edit_request'),
    path('quotation/generate/', views.generate_quotation_link, name='generate_quotation_link'),
    path('quotation/fill/<str:token>/', views.quotation_fill_view, name='quotation_fill'),
    path('quotation/view/', views.principal_view_quotations, name='principal_view_quotations'),
    path('quotation/select/<int:response_id>/', views.select_quotation, name='select_quotation'),
    path('reports/', views.reports_view, name='reports'),
    path('reports/approved-quotations/', views.approved_quotations_reports_view, name='approved_quotations_reports'),
    path('departments/', views.department_list, name='department_list'),
    path('principal/quotations/<int:batch_id>/',views.principal_view_quotations_batch,name='principal_view_quotations_batch'),
]
 