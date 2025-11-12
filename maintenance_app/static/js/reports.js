// reports.js - Updated for Django template
document.addEventListener('DOMContentLoaded', () => {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const customPicker = document.getElementById('customPicker');
  const customDateInput = document.getElementById('customDate');
  const applyBtn = document.getElementById('applyCustom');
  const resultsTitle = document.getElementById('resultsTitle');
  const reportsTable = document.getElementById('reportsTable');
  const tableBody = reportsTable ? reportsTable.querySelector('tbody') : null;
  const departmentFilter = document.getElementById('departmentFilter');
  const summarySelect = document.getElementById('summaryDepartment');
  const summaryAmount = document.getElementById('summaryAmount');

  const departmentTotals = window.DEPARTMENT_TOTALS || {};
  const grandTotal = typeof window.GRAND_TOTAL === 'number'
    ? window.GRAND_TOTAL
    : parseFloat(window.GRAND_TOTAL || 0);

  const rowElements = tableBody ? Array.from(tableBody.querySelectorAll('tr[data-department]')) : [];
  const rowData = rowElements.map(row => ({
    element: row,
    department: row.getAttribute('data-department') || 'All',
    date: parseDate(row.getAttribute('data-date')),
  }));

  let baseTitle = 'Approved quotations';
  let activeDateRange = null;
  let currentDept = 'All';
  let lastVisibleCount = rowData.length;

  // Initialise summary dropdown display
  updateSummaryAmount();

  // Initialise filters (default to "This Week")
  showCustomPicker(false);
  if (filterButtons.length > 0) {
    const weekBtn = Array.from(filterButtons).find(btn => btn.dataset.filter === 'week');
    if (weekBtn) {
      setActiveFilter(weekBtn);
      applyQuickFilter('week');
    } else {
      applyFilters();
    }
  } else {
    applyFilters();
  }

  // Event bindings ---------------------------------------------------------
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveFilter(btn);
      const filter = btn.dataset.filter;

      if (filter === 'custom') {
        showCustomPicker(true);
      } else {
        showCustomPicker(false);
        applyQuickFilter(filter);
      }
    });
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const dateVal = customDateInput?.value;
      if (!dateVal) {
        alert('Please choose a date.');
        return;
      }
      applyCustomDate(dateVal);
    });
  }

  if (departmentFilter) {
    departmentFilter.addEventListener('change', () => {
      currentDept = departmentFilter.value || 'All';
      applyFilters();

      // Sync summary dropdown when possible
      if (summarySelect) {
        if (currentDept === 'All' || Object.prototype.hasOwnProperty.call(departmentTotals, currentDept)) {
          summarySelect.value = currentDept;
          updateSummaryAmount();
        }
      }
    });
  }

  if (summarySelect) {
    summarySelect.addEventListener('change', updateSummaryAmount);
  }

  // -----------------------------------------------------------------------
  function setActiveFilter(btn) {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  function showCustomPicker(show) {
    if (customPicker) {
      customPicker.style.display = show ? 'flex' : 'none';
      customPicker.setAttribute('aria-hidden', String(!show));
    }
  }

  function applyQuickFilter(type) {
    const now = new Date();
    let startDate;
    let endDate;

    if (type === 'week') {
      const day = now.getDay(); // 0 (Sun) - 6 (Sat)
      const diff = day === 0 ? 6 : day - 1; // Start on Monday
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      baseTitle = `Approved quotations • This Week (${formatDate(startDate)} - ${formatDate(endDate)})`;
    } else if (type === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      baseTitle = `Approved quotations • This Month (${startDate.toLocaleString('default', { month: 'short', year: 'numeric' })})`;
    } else if (type === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      baseTitle = `Approved quotations • This Year (${now.getFullYear()})`;
    } else {
      // Fallback: show all
      startDate = null;
      endDate = null;
      baseTitle = 'Approved quotations • All reports';
    }

    activeDateRange = startDate && endDate ? { start: startDate, end: endDate } : null;
    applyFilters();
  }

  function applyCustomDate(dateStr) {
    const selected = parseDate(dateStr);
    if (!selected) {
      alert('Invalid date selected.');
      return;
    }

    const start = new Date(selected);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selected);
    end.setHours(23, 59, 59, 999);

    baseTitle = `Approved quotations • ${formatDate(start)}`;
    activeDateRange = { start, end };
    applyFilters();
  }

  function applyFilters() {
    if (!rowData.length) {
      lastVisibleCount = 0;
      updateResultsTitle();
      return;
    }

    lastVisibleCount = 0;

    rowData.forEach(({ element, department, date }) => {
      const matchesDept = currentDept === 'All' || department === currentDept;
      const matchesDate = !activeDateRange || (date && date >= activeDateRange.start && date <= activeDateRange.end);
      const shouldShow = matchesDept && matchesDate;

      element.style.display = shouldShow ? '' : 'none';
      if (shouldShow) {
        lastVisibleCount += 1;
      }
    });

    updateResultsTitle();
  }

  function updateResultsTitle() {
    if (!resultsTitle) return;

    const deptLabel = currentDept === 'All' ? 'All departments' : currentDept;
    const titleText = baseTitle || 'Approved quotations';
    resultsTitle.textContent = `Showing: ${titleText} • ${deptLabel} (${lastVisibleCount})`;
  }

  function updateSummaryAmount() {
    if (!summarySelect || !summaryAmount) return;

    const selected = summarySelect.value || 'All';
    let amount = grandTotal;

    if (selected !== 'All') {
      amount = Object.prototype.hasOwnProperty.call(departmentTotals, selected)
        ? departmentTotals[selected]
        : 0;
    }

    summaryAmount.textContent = formatCurrency(amount || 0);
  }

  function parseDate(dateStr) {
    return dateStr ? new Date(`${dateStr}T00:00:00`) : null;
  }

  function formatDate(dateObj) {
    if (!dateObj) return '';
    return new Date(dateObj).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatCurrency(value) {
    const number = Number(value || 0);
    return `₹${number.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
});
