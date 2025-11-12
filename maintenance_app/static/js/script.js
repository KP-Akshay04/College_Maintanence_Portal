
document.addEventListener("DOMContentLoaded", function () {
  const selectAll = document.getElementById("selectAll");
  const sendBtn = document.getElementById("sendQuotationBtn")
  const generatedArea = document.getElementById("generatedLinkArea");
  const showLastLinkBtn = document.getElementById("showLastLinkBtn");
  
  // ✅ Get CSRF token - try from global variable first, then from DOM
  let CSRF_TOKEN = window.CSRF_TOKEN || document.querySelector("[name=csrfmiddlewaretoken]")?.value;
  
  if (!CSRF_TOKEN) {
    console.error("CSRF token not found!");
  }

  // ✅ Function to show temporary success message
  function showSuccessMessage(message, type = 'success') {
    console.log('showSuccessMessage called with:', message, type); // Debug log
    
    // Try to find messages container by ID first, then by class
    let messagesContainer = document.getElementById('messagesContainer');
    
    if (!messagesContainer) {
      // Fallback: find container after navbar
      const containers = document.querySelectorAll('.container.mt-3');
      messagesContainer = containers.length > 0 ? containers[0] : null;
    }
    
    // If still not found, create one
    if (!messagesContainer) {
      console.error('Messages container not found, creating one');
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
    
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.setAttribute('role', 'alert');
    alertDiv.style.cssText = 'margin-bottom: 1rem;';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Insert at the beginning of messages container (or append if empty)
    if (messagesContainer.firstChild) {
      messagesContainer.insertBefore(alertDiv, messagesContainer.firstChild);
    } else {
      messagesContainer.appendChild(alertDiv);
    }
    
    // Scroll to top to show message
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Auto-remove after 5 seconds
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

  // ✅ Select-all checkbox
  selectAll?.addEventListener("change", (e) => {
    e.stopPropagation();
    const checked = e.target.checked;
    document.querySelectorAll(".req-checkbox").forEach((cb) => (cb.checked = checked));
  });

  // ✅ Prevent checkbox clicks from triggering anything else
  document.querySelectorAll(".req-checkbox").forEach((cb) => {
    cb.addEventListener("click", (e) => e.stopPropagation());
  });

  // ✅ AJAX Approve / Reject buttons (only forms with class ajax-form)
  document.querySelectorAll("form.ajax-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const button = form.querySelector("button[type='submit']");
      const originalText = button?.textContent;
      const isApprove = button?.textContent.trim().toLowerCase().includes('approve');
      const actionType = isApprove ? 'Approved' : 'Rejected';
      
      if (button) {
        button.disabled = true;
        button.textContent = "Processing...";
      }

      try {
        // Get CSRF token from the form itself
        const formToken = form.querySelector("[name=csrfmiddlewaretoken]")?.value || CSRF_TOKEN;
        
        if (!formToken) {
          console.error("No CSRF token found!");
          throw new Error("CSRF token missing");
        }
        
        // Create FormData to include CSRF token in body
        const formData = new FormData(form);
        
        console.log('Sending request to:', form.action); // Debug log
        
        const res = await fetch(form.action, {
          method: "POST",
          headers: {
            "X-CSRFToken": formToken,
            "X-Requested-With": "XMLHttpRequest",
          },
          body: formData,
        });

        console.log('Response status:', res.status); // Debug log

        // Check if response is JSON
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error("Non-JSON response:", text);
          throw new Error("Server returned non-JSON response");
        }

        const data = await res.json();
        console.log('Response data:', data); // Debug log

        if (data.success) {
          // Update status in table
          const row = form.closest("tr");
          const statusCell = row.querySelector(".status");
          if (statusCell) {
            statusCell.textContent = data.new_status;
            statusCell.className = `status ${data.new_status}`;
          }
          
          // Show success message at the top of the page
          showSuccessMessage(
            `✅ Request ${actionType.toLowerCase()} successfully! Email notification has been sent to the HOD.`,
            'success'
          );
        } else {
          showSuccessMessage(data.message || "Action failed.", 'danger');
        }
      } catch (err) {
        console.error("Error:", err);
        showSuccessMessage("Something went wrong while updating status! Please try again.", 'danger');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    });
  });

  // ✅ Generate quotation link
  sendBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const selected = Array.from(document.querySelectorAll(".req-checkbox:checked")).map(
      (cb) => cb.value
    );

    if (selected.length === 0) {
      alert("Please select at least one request.");
      return;
    }

    // Disable button during processing
    sendBtn.disabled = true;
    const originalText = sendBtn.textContent;
    sendBtn.textContent = "Generating...";

    try {
      const formData = new FormData();
      selected.forEach((id) => formData.append("selected_requests[]", id));
      formData.append("csrfmiddlewaretoken", CSRF_TOKEN);

      const res = await fetch(generateUrl, {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": CSRF_TOKEN,
        },
        body: formData,
      });

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server returned non-JSON response");
      }

      const data = await res.json();

      if (data.success) {
        generatedArea.innerHTML = `
          <div class="alert alert-success">
            ✅ Quotation link generated successfully!<br>
            <strong>Share this link with vendors:</strong><br>
            <a href="${data.link}" target="_blank" id="quotationLink" class="text-break">${data.link}</a>
            <br><br>
            <button id="copyLinkBtn" class="btn btn-sm btn-primary">Copy Link</button>
          </div>`;
        showLastLinkBtn.style.display = "inline-block";

        const copyBtn = document.getElementById("copyLinkBtn");
        copyBtn.addEventListener("click", async () => {
          const linkText = document.getElementById("quotationLink").href;
          try {
            await navigator.clipboard.writeText(linkText);
            copyBtn.textContent = "✓ Copied!";
            copyBtn.classList.replace("btn-primary", "btn-success");
            setTimeout(() => {
              copyBtn.textContent = "Copy Link";
              copyBtn.classList.replace("btn-success", "btn-primary");
            }, 2000);
          } catch {
            alert("Failed to copy. Please copy manually.");
          }
        });
      } else {
        generatedArea.innerHTML = `<div class="alert alert-danger">${data.message}</div>`;
      }
    } catch (err) {
      console.error("Error generating quotation link:", err);
      generatedArea.innerHTML = `
        <div class="alert alert-danger">
          Failed to generate quotation link. Error: ${err.message}. Please check console.
        </div>`;
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = originalText;
    }
  });

  // ✅ Optional: show last link button
  showLastLinkBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Link is already displayed below.");
  });

  // ✅ Clickable cards for filtering
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => {
      const title = card.querySelector("h6")?.textContent || "";
      if (title.includes("Pending")) window.location.href = "?status=Pending";
      else if (title.includes("Approved")) window.location.href = "?status=Approved";
      else if (title.includes("Rejected")) window.location.href = "?status=Rejected";
      else window.location.href = window.location.pathname;
    });
  });
});
