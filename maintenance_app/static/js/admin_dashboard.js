document.addEventListener('DOMContentLoaded', () => {
  // Get global variables
  const CSRF_TOKEN = window.CSRF_TOKEN || document.querySelector("[name=csrfmiddlewaretoken]")?.value;
  const generateUrl = window.GENERATE_URL;
  
  if (!CSRF_TOKEN) {
    console.error("CSRF token not found!");
  }

  // Function to show success/error messages
  function showMessage(message, type = 'success') {
    let messagesContainer = document.getElementById('messagesContainer');
    
    if (!messagesContainer) {
      messagesContainer = document.createElement('div');
      messagesContainer.id = 'messagesContainer';
      messagesContainer.className = 'container mt-3';
      const navbar = document.querySelector('nav');
      if (navbar && navbar.nextSibling) {
        navbar.parentNode.insertBefore(messagesContainer, navbar.nextSibling);
      } else {
        document.body.insertBefore(messagesContainer, document.body.firstChild);
      }
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.setAttribute('role', 'alert');
    alertDiv.style.cssText = 'margin-bottom: 1rem;';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    if (messagesContainer.firstChild) {
      messagesContainer.insertBefore(alertDiv, messagesContainer.firstChild);
    } else {
      messagesContainer.appendChild(alertDiv);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setTimeout(() => {
      if (alertDiv && alertDiv.parentNode) {
        alertDiv.classList.remove('show');
        setTimeout(() => {
          if (alertDiv && alertDiv.parentNode) {
            alertDiv.remove();
          }
        }, 300);
      }
    }, 5000);
  }

  // Get table rows - use a function to get fresh rows each time
  function getTableRows() {
    const table = document.getElementById('requestTable');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tbody tr'));
  }

  // Elements
  const colDeptIcon = document.getElementById('colDeptIcon');
  const colDeptDropdown = document.getElementById('colDeptDropdown');
  const colStatusIcon = document.getElementById('colStatusIcon');
  const colStatusDropdown = document.getElementById('colStatusDropdown');
  const navbarDeptItems = document.querySelectorAll('.navbar-dept-filter');

  // Helper: open/close dropdowns (only one open at a time)
  function closeAllColumnDropdowns() {
    if (colDeptDropdown) colDeptDropdown.classList.remove('active');
    if (colStatusDropdown) colStatusDropdown.classList.remove('active');
    if (colDeptIcon) colDeptIcon.classList.remove('active');
    if (colStatusIcon) colStatusIcon.classList.remove('active');
  }

  // Combined filter logic - FIXED VERSION
  function applyCombinedFilters(deptFilterVal, statusFilterVal) {
    const rows = getTableRows();
    
    rows.forEach(row => {
      // Get department - from dept-cell
      const deptCell = row.querySelector('.dept-cell');
      const rowDept = deptCell ? deptCell.textContent.trim() : '';
      
      // Get status - from the status span inside status-cell (more reliable)
      const statusSpan = row.querySelector('.status-cell .status');
      const rowStatus = statusSpan ? statusSpan.textContent.trim() : '';
      
      // Debug logging (remove in production)
      // console.log('Row:', rowDept, rowStatus, 'Filters:', deptFilterVal, statusFilterVal);
      
      // Apply filters
      const matchDept = !deptFilterVal || deptFilterVal === '' || rowDept === deptFilterVal;
      const matchStatus = !statusFilterVal || statusFilterVal === '' || rowStatus === statusFilterVal;
      
      // Show row if both filters match
      if (matchDept && matchStatus) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
    
    // Update select all checkbox state
    updateSelectAllCheckbox();
  }

  // Update select all checkbox based on visible rows
  function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAll');
    if (!selectAllCheckbox) return;
    
    const visibleRows = getTableRows().filter(row => row.style.display !== 'none');
    const visibleChecked = visibleRows.filter(row => {
      const cb = row.querySelector('.req-checkbox');
      return cb && cb.checked;
    });
    
    if (visibleRows.length === 0) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = false;
    } else if (visibleChecked.length === visibleRows.length) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = true;
    } else if (visibleChecked.length > 0) {
      selectAllCheckbox.indeterminate = true;
      selectAllCheckbox.checked = false;
    } else {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = false;
    }
  }

  // Track current selections
  let currentDeptFilter = '';
  let currentStatusFilter = '';

  // Open/close dropdowns when clicking icons - FIXED: prevent event propagation
  if (colDeptIcon) {
    colDeptIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nowOpen = colDeptDropdown.classList.toggle('active');
      colDeptIcon.classList.toggle('active', nowOpen);
      if (colStatusDropdown) colStatusDropdown.classList.remove('active');
      if (colStatusIcon) colStatusIcon.classList.remove('active');
    });
  }

  if (colStatusIcon) {
    colStatusIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nowOpen = colStatusDropdown.classList.toggle('active');
      colStatusIcon.classList.toggle('active', nowOpen);
      if (colDeptDropdown) colDeptDropdown.classList.remove('active');
      if (colDeptIcon) colDeptIcon.classList.remove('active');
    });
  }

  // Clicking outside closes dropdowns - FIXED: don't close when clicking inside dropdown
  document.addEventListener('click', (e) => {
    const isClickInsideDropdown = e.target.closest('.col-filter-dropdown');
    const isClickOnIcon = e.target.classList.contains('filter-icon') || e.target.closest('.filter-icon');
    
    if (!isClickInsideDropdown && !isClickOnIcon) {
      closeAllColumnDropdowns();
    }
  });

  // Header column dropdown buttons - FIXED: prevent default and stop propagation
  if (colDeptDropdown) {
    colDeptDropdown.querySelectorAll('button[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove active from all buttons in this dropdown
        colDeptDropdown.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        // Add active to clicked button
        btn.classList.add('active');
        
        currentDeptFilter = btn.dataset.filter || '';
        applyCombinedFilters(currentDeptFilter, currentStatusFilter);
        closeAllColumnDropdowns();
      });
    });
  }

  if (colStatusDropdown) {
    colStatusDropdown.querySelectorAll('button[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove active from all buttons in this dropdown
        colStatusDropdown.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        // Add active to clicked button
        btn.classList.add('active');
        
        currentStatusFilter = btn.dataset.filter || '';
        applyCombinedFilters(currentDeptFilter, currentStatusFilter);
        closeAllColumnDropdowns();
      });
    });
  }

  // Navbar department items - FIXED: update both navbar and header dropdown state
  navbarDeptItems.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const val = a.dataset.dept || '';
      
      // Update header dropdown button state
      if (colDeptDropdown) {
        colDeptDropdown.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        const matchedBtn = Array.from(colDeptDropdown.querySelectorAll('button')).find(b => (b.dataset.filter || '') === val);
        if (matchedBtn) matchedBtn.classList.add('active');
      }
      
      currentDeptFilter = val;
      applyCombinedFilters(currentDeptFilter, currentStatusFilter);
      closeAllColumnDropdowns();
    });
  });

  // Select All checkbox behavior - FIXED: only affect visible rows
  const selectAllCheckbox = document.getElementById('selectAll');
  selectAllCheckbox?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    const rows = getTableRows();
    rows.forEach(row => {
      if (row.style.display !== 'none') {
        const cb = row.querySelector('.req-checkbox');
        if (cb) cb.checked = checked;
      }
    });
  });

  // Prevent checkbox clicks from triggering anything else
  document.querySelectorAll('.req-checkbox').forEach(cb => {
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      updateSelectAllCheckbox();
    });
  });

  // AJAX Approve / Reject buttons
  document.querySelectorAll('form.ajax-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const button = form.querySelector('button[type="submit"]');
      const originalText = button?.textContent;
      const isApprove = button?.textContent.trim().toLowerCase().includes('approve');
      const actionType = isApprove ? 'Approved' : 'Rejected';
      
      if (button) {
        button.disabled = true;
        button.textContent = 'Processing...';
      }

      try {
        const formToken = form.querySelector('[name=csrfmiddlewaretoken]')?.value || CSRF_TOKEN;
        
        if (!formToken) {
          console.error('No CSRF token found!');
          throw new Error('CSRF token missing');
        }
        
        const formData = new FormData(form);
        
        const res = await fetch(form.action, {
          method: 'POST',
          headers: {
            'X-CSRFToken': formToken,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: formData,
        });

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          console.error('Non-JSON response:', text);
          throw new Error('Server returned non-JSON response');
        }

        const data = await res.json();

        if (data.success) {
          // Update status in table
          const row = form.closest('tr');
          const statusSpan = row.querySelector('.status-cell .status');
          if (statusSpan) {
            statusSpan.textContent = data.new_status;
            statusSpan.className = `status ${data.new_status}`;
          }
          
          // Reapply filters after status change
          applyCombinedFilters(currentDeptFilter, currentStatusFilter);
          
          // Show success message at the top of the page
          showMessage(
            `✅ Request ${actionType.toLowerCase()} successfully! Email notification has been sent to the HOD.`,
            'success'
          );
        } else {
          showMessage(data.message || 'Action failed.', 'danger');
        }
      } catch (err) {
        console.error('Error:', err);
        showMessage('Something went wrong while updating status! Please try again.', 'danger');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    });
  });

  // Quotation button: Generate link and show copy button
  const sendBtn = document.getElementById('sendQuotationBtn');
  const generatedLinkArea = document.getElementById('generatedLinkArea');
  
  sendBtn?.addEventListener('click', async () => {
    // Only get selected checkboxes from visible rows
    const visibleRows = getTableRows().filter(row => row.style.display !== 'none');
    const selected = visibleRows
      .filter(row => {
        const cb = row.querySelector('.req-checkbox');
        return cb && cb.checked;
      })
      .map(row => {
        const cb = row.querySelector('.req-checkbox');
        return cb ? cb.value : null;
      })
      .filter(val => val !== null);
    
    if (!selected.length) {
      showMessage('Please select at least one request.', 'warning');
      return;
    }
    
    sendBtn.disabled = true;
    const originalText = sendBtn.textContent;
    sendBtn.textContent = 'Generating...';
    
    try {
      const fd = new FormData();
      selected.forEach(id => fd.append('selected_requests[]', id));
      fd.append('csrfmiddlewaretoken', CSRF_TOKEN);
      
      const res = await fetch(generateUrl, {
        method: 'POST',
        body: fd,
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRFToken': CSRF_TOKEN,
        }
      });
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await res.json();
      
      if (data.success) {
        generatedLinkArea.innerHTML = `
          <div class="alert alert-success mb-2">
            <strong>✅ Quotation link generated successfully!</strong><br>
            <small>Share this link with vendors:</small><br>
            <div class="d-flex align-items-center gap-2 mt-2">
              <input type="text" class="form-control form-control-sm" id="quotationLinkInput" value="${data.link}" readonly>
              <button id="copyLinkBtn" class="btn btn-primary btn-sm" title="Copy link">
                <i class="bi bi-clipboard"></i> Copy
              </button>
            </div>
            <a href="${data.link}" target="_blank" class="text-break small d-block mt-2">${data.link}</a>
          </div>
        `;
        
        // Add copy button functionality
        const copyBtn = document.getElementById('copyLinkBtn');
        const linkInput = document.getElementById('quotationLinkInput');
        
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(data.link);
            copyBtn.innerHTML = '<i class="bi bi-check"></i> Copied!';
            copyBtn.classList.replace('btn-primary', 'btn-success');
            setTimeout(() => {
              copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
              copyBtn.classList.replace('btn-success', 'btn-primary');
            }, 2000);
          } catch (err) {
            // Fallback for older browsers
            linkInput.select();
            document.execCommand('copy');
            copyBtn.innerHTML = '<i class="bi bi-check"></i> Copied!';
            copyBtn.classList.replace('btn-primary', 'btn-success');
            setTimeout(() => {
              copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
              copyBtn.classList.replace('btn-success', 'btn-primary');
            }, 2000);
          }
        });
      } else {
        generatedLinkArea.innerHTML = `<div class="alert alert-danger">${data.message || 'Failed to generate link'}</div>`;
      }
    } catch (err) {
      console.error('Error generating quotation link:', err);
      generatedLinkArea.innerHTML = `<div class="alert alert-danger">Error generating link. Please try again.</div>`;
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = originalText;
    }
  });
  
  // Initialize: Apply any existing filters from URL parameters (if needed)
  // This ensures filters work on page load if URL has filter parameters
  const urlParams = new URLSearchParams(window.location.search);
  const statusParam = urlParams.get('status');
  const deptParam = urlParams.get('department');
  
  if (statusParam && colStatusDropdown) {
    const statusBtn = Array.from(colStatusDropdown.querySelectorAll('button')).find(
      b => (b.dataset.filter || '').toLowerCase() === statusParam.toLowerCase()
    );
    if (statusBtn) {
      statusBtn.click();
    }
  }
  
  if (deptParam && colDeptDropdown) {
    const deptBtn = Array.from(colDeptDropdown.querySelectorAll('button')).find(
      b => (b.dataset.filter || '').toLowerCase() === deptParam.toLowerCase()
    );
    if (deptBtn) {
      deptBtn.click();
    }
  }
});
