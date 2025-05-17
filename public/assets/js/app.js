document.addEventListener('DOMContentLoaded', function() {
    const activityTable = document.querySelector('#activity-history-table');
    if (activityTable) {
        initTableSort(activityTable);
        
        const tableHeader = activityTable.closest('.card').querySelector('.card-header');
        if (tableHeader) {
            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'btn btn-sm btn-light ms-2';
            refreshBtn.innerHTML = '<i class="fal fa-sync"></i>';
            refreshBtn.title = 'Refresh';
            refreshBtn.addEventListener('click', function() {
                loadActivityHistory();
            });
            tableHeader.querySelector('div').appendChild(refreshBtn);
        }
        
        loadActivityHistory();
    }
    
    const passwordToggleBtns = document.querySelectorAll('.password-toggle-btn');
    passwordToggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fal fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fal fa-eye';
            }
        });
    });
    const formSubmissions = new Map();
    
    const forms = document.querySelectorAll('form[action^="/api/"]');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            const formAction = this.getAttribute('action');
            const submitBtn = this.querySelector('button[type="submit"]');
            const spinner = submitBtn ? submitBtn.querySelector('.spinner-border') : null;
            let alertElement = this.querySelector('.alert');
            if (!alertElement) {
                alertElement = document.createElement('div');
                alertElement.className = 'alert rounded mb-3';
                alertElement.style.display = 'none';
                this.insertBefore(alertElement, this.firstChild);
            }
            if (alertElement) {
                alertElement.style.display = 'none';
            }
            
            if (spinner) {
                spinner.classList.remove('d-none');
                submitBtn.disabled = true;
            }
            fetch(formAction, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                },
                body: JSON.stringify(data),
                credentials: 'include'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(result => {
                if (spinner) {
                    spinner.classList.add('d-none');
                    submitBtn.disabled = false;
                }
                if (alertElement) {
                    alertElement.textContent = result.message;
                    alertElement.style.display = 'block';
                    alertElement.className = `alert rounded mb-3 ${result.success ? 'alert-success' : 'alert-danger'}`;
                }
                if (result.success) {
                    if (formAction.includes('update-profile')) {
                        if (result.token) {
                            localStorage.setItem('token', result.token);
                            
                            window.location.reload();
                        }
                    }
                    
                    if (document.getElementById('activity-history-table')) {
                        setTimeout(() => loadActivityHistory(), 1000);
                    }
                    
                    if (formAction.includes('change-password')) {
                        form.reset();
                    }
                }
            })
            .catch(error => {
                console.error('Form submission error:', error);
                
                if (spinner) {
                    spinner.classList.add('d-none');
                    submitBtn.disabled = false;
                }
                
                if (alertElement) {
                    alertElement.textContent = 'Đã xảy ra lỗi khi xử lý yêu cầu: ' + error.message;
                    alertElement.style.display = 'block';
                    alertElement.className = 'alert alert-danger rounded mb-3';
                }
            });
        });
    });
});

/**
 * Update profile display information
 * @param {Object} data - The updated user data
 */
function updateProfileDisplay(data) {
    const displayFields = document.querySelectorAll('.user-info-display');
    if (displayFields.length > 0) {
        displayFields.forEach(field => {
            const fieldName = field.getAttribute('data-field');
            if (fieldName && data[fieldName]) {
                field.textContent = data[fieldName];
            }
        });
    }
    
    const userNameDisplay = document.querySelector('.user-name-display');
    if (userNameDisplay && data.name) {
        userNameDisplay.textContent = data.name;
    }
    
    const sidebarName = document.querySelector('.sidebar-user-name');
    if (sidebarName && data.name) {
        sidebarName.textContent = data.name;
    }
    
    const sidebarEmail = document.querySelector('.sidebar-user-email');
    if (sidebarEmail && data.email) {
        sidebarEmail.textContent = data.email;
    }
    
    const avatarInitials = document.querySelectorAll('.user-avatar-initial');
    if (avatarInitials.length > 0 && data.name) {
        avatarInitials.forEach(avatar => {
            avatar.textContent = data.name[0];
        });
    }
}

function updateUserInterface(data) {
    document.querySelectorAll('.user-info-display').forEach(element => {
        const field = element.getAttribute('data-field');
        if (field && data[field]) {
            element.textContent = data[field];
        }
    });
    
    if (data.name) {
        document.querySelectorAll('.user-name-display').forEach(el => {
            el.textContent = data.name;
        });
        
        document.querySelectorAll('.user-avatar, .user-avatar-initial').forEach(el => {
            el.textContent = data.name.charAt(0);
        });
    }
    
    document.querySelectorAll('.sidebar-user-name').forEach(el => {
        if (data.name) el.textContent = data.name;
    });
    
    document.querySelectorAll('.sidebar-user-email').forEach(el => {
        if (data.email) el.textContent = data.email;
    });
    
    if (data.name) document.querySelector('input[name="name"]').value = data.name;
    if (data.username) document.querySelector('input[name="username"]').value = data.username;
    if (data.email) document.querySelector('input[name="email"]').value = data.email;
    if (data.phone) document.querySelector('input[name="phone"]').value = data.phone;
    
    document.body.style.display = 'none';
    document.body.offsetHeight; 
    document.body.style.display = '';
}

function loadActivityHistory(page = 1, limit = 10) {
    const activityTable = document.getElementById('activity-history-table');
    if (!activityTable) return;
    
    const paginationContainer = document.querySelector('#activity-pagination');
    const tbody = activityTable.querySelector('tbody');
    
    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-4">
                <div class="d-flex justify-content-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </td>
        </tr>
    `;
    
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
    }
    
    fetch(`/api/user/activity-history?page=${page}&limit=${limit}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && Array.isArray(data.activities)) {
                if (data.activities.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center py-4">
                                <div class="d-flex flex-column align-items-center">
                                    <i class="fal fa-inbox fs-1 text-muted mb-2"></i>
                                    <p class="text-muted mb-0">Chưa có hoạt động nào được ghi nhận</p>
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    tbody.innerHTML = '';
                    data.activities.forEach((activity, index) => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <th scope="row">${(data.pagination.page - 1) * data.pagination.limit + index + 1}</th>
                            <td>${activity.action || ''}</td>
                            <td>${activity.details || ''}</td>
                            <td data-sort-value="${activity.timestampValue}">${activity.timestamp}</td>
                            <td>
                                ${activity.success 
                                    ? '<span class="badge bg-success"><i class="fal fa-check me-1"></i>Thành công</span>' 
                                    : '<span class="badge bg-danger"><i class="fal fa-times me-1"></i>Thất bại</span>'}
                            </td>
                        `;
                        tbody.appendChild(row);
                    });
                    
                    const activeSort = activityTable.querySelector('th.sort-asc, th.sort-desc');
                    if (activeSort) {
                        const column = activeSort.dataset.sort;
                        const direction = activeSort.classList.contains('sort-asc') ? 'asc' : 'desc';
                        sortTable(activityTable, column, direction);
                    }
                    
                    if (data.pagination && data.pagination.pages > 1 && paginationContainer) {
                        renderPagination(paginationContainer, data.pagination, page);
                    }
                }
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-4">
                            <div class="d-flex flex-column align-items-center">
                                <i class="fal fa-exclamation-circle fs-1 text-warning mb-2"></i>
                                <p class="text-muted mb-0">Không thể tải lịch sử hoạt động</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading activity history:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="fal fa-exclamation-circle fs-1 text-danger mb-2"></i>
                            <p class="text-muted mb-0">Đã xảy ra lỗi khi tải lịch sử hoạt động</p>
                        </div>
                    </td>
                </tr>
            `;
        });
}

/**
 * Render pagination controls
 * @param {HTMLElement} container - The container element for pagination
 * @param {Object} pagination - Pagination data
 * @param {number} currentPage - Current active page
 */
function renderPagination(container, pagination, currentPage) {
    container.innerHTML = '';
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Activity pagination');
    const ul = document.createElement('ul');
    ul.className = 'pagination justify-content-center mb-0';
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${pagination.page <= 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '<i class="fal fa-chevron-left"></i>';
    prevLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (pagination.page > 1) {
            loadActivityHistory(pagination.page - 1, pagination.limit);
        }
    });
    prevLi.appendChild(prevLink);
    ul.appendChild(prevLi);
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.pages, pagination.page + 2);
    if (startPage > 1) {
        const firstLi = document.createElement('li');
        firstLi.className = 'page-item';
        
        const firstLink = document.createElement('a');
        firstLink.className = 'page-link';
        firstLink.href = '#';
        firstLink.textContent = '1';
        firstLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadActivityHistory(1, pagination.limit);
        });
        firstLi.appendChild(firstLink);
        ul.appendChild(firstLi);
        if (startPage > 2) {
            const ellipsisLi = document.createElement('li');
            ellipsisLi.className = 'page-item disabled';
            
            const ellipsisSpan = document.createElement('span');
            ellipsisSpan.className = 'page-link';
            ellipsisSpan.innerHTML = '&hellip;';
            ellipsisLi.appendChild(ellipsisSpan);
            ul.appendChild(ellipsisLi);
        }
    }
    for (let i = startPage; i <= endPage; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === pagination.page ? 'active' : ''}`;
        
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.textContent = i;
        pageLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadActivityHistory(i, pagination.limit);
        });
        pageLi.appendChild(pageLink);
        ul.appendChild(pageLi);
    }
    if (endPage < pagination.pages) {
        if (endPage < pagination.pages - 1) {
            const ellipsisLi = document.createElement('li');
            ellipsisLi.className = 'page-item disabled';
            const ellipsisSpan = document.createElement('span');
            ellipsisSpan.className = 'page-link';
            ellipsisSpan.innerHTML = '&hellip;';
            ellipsisLi.appendChild(ellipsisSpan);
            ul.appendChild(ellipsisLi);
        }
        const lastLi = document.createElement('li');
        lastLi.className = 'page-item';
        const lastLink = document.createElement('a');
        lastLink.className = 'page-link';
        lastLink.href = '#';
        lastLink.textContent = pagination.pages;
        lastLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadActivityHistory(pagination.pages, pagination.limit);
        });
        lastLi.appendChild(lastLink);
        ul.appendChild(lastLi);
    }
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${pagination.page >= pagination.pages ? 'disabled' : ''}`;
    
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.innerHTML = '<i class="fal fa-chevron-right"></i>';
    nextLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (pagination.page < pagination.pages) {
            loadActivityHistory(pagination.page + 1, pagination.limit);
        }
    });
    nextLi.appendChild(nextLink);
    ul.appendChild(nextLi);
    nav.appendChild(ul);
    container.appendChild(nav);
    const pageSizeContainer = document.createElement('div');
    pageSizeContainer.className = 'text-center mt-3';
    
    const pageSizeLabel = document.createElement('span');
    pageSizeLabel.className = 'text-muted me-2';
    pageSizeLabel.textContent = 'Số dòng mỗi trang:';
    
    const pageSizeSelect = document.createElement('select');
    pageSizeSelect.className = 'form-select form-select-sm d-inline-block w-auto';
    
    [5, 10, 25, 50].forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        option.selected = size === pagination.limit;
        pageSizeSelect.appendChild(option);
    });
    
    pageSizeSelect.addEventListener('change', function() {
        loadActivityHistory(1, this.value);
    });
    
    pageSizeContainer.appendChild(pageSizeLabel);
    pageSizeContainer.appendChild(pageSizeSelect);
    container.appendChild(pageSizeContainer);
}

/**
 * Initialize table sorting functionality
 * @param {HTMLTableElement} table 
 */
function initTableSort(table) {
    const headers = table.querySelectorAll('th[data-sort]');
    let currentSort = null;
    
    headers.forEach(header => {
        const icon = document.createElement('i');
        icon.className = 'fal fa-sort ms-1';
        header.appendChild(icon);
        
        header.addEventListener('click', function() {
            const column = this.dataset.sort;
            const direction = this.classList.contains('sort-asc') ? 'desc' : 'asc';
            
            headers.forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
                h.querySelector('i').className = 'fal fa-sort ms-1';
            });
            
            this.classList.add(`sort-${direction}`);
            this.querySelector('i').className = `fal fa-sort ms-1`;
            
            sortTable(table, column, direction);
            
            currentSort = { column, direction };
        });
    });
}

/**
 * Sort table by specified column and direction
 * @param {HTMLTableElement} table
 * @param {string} column
 * @param {string} direction
 */
function sortTable(table, column, direction) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    if (rows.length <= 1 && rows[0].querySelector('td[colspan]')) {
        return;
    }
    
    const sortedRows = rows.sort((a, b) => {
        const aCol = a.querySelector(`td:nth-child(${parseInt(column) + 1})`) || 
                     a.querySelector(`th:nth-child(${parseInt(column) + 1})`);
        const bCol = b.querySelector(`td:nth-child(${parseInt(column) + 1})`) || 
                     b.querySelector(`th:nth-child(${parseInt(column) + 1})`);
        
        if (!aCol || !bCol) return 0;
        
        let aValue = aCol.dataset.sortValue || aCol.textContent.trim();
        let bValue = bCol.dataset.sortValue || bCol.textContent.trim();
        
        if (!isNaN(aValue) && !isNaN(bValue)) {
            aValue = parseFloat(aValue);
            bValue = parseFloat(bValue);
        } else {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        
        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
    
    sortedRows.forEach(row => {
        tbody.appendChild(row);
    });
}
