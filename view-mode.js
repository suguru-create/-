// ===== View Mode Management =====

// Add view mode property and methods to SalesListManager
(function () {
    const originalConstructor = SalesListManager.prototype.constructor;

    // Extend constructor
    SalesListManager.prototype.initViewMode = function () {
        this.viewMode = localStorage.getItem('viewMode') || 'table';
        this.setViewMode(this.viewMode, false);
    };

    // Set view mode
    SalesListManager.prototype.setViewMode = function (mode, save = true) {
        this.viewMode = mode;

        if (save) {
            localStorage.setItem('viewMode', mode);
        }

        // Update button states
        document.querySelectorAll('.view-mode-btn').forEach(btn => {
            if (btn.dataset.view === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Render appropriate view
        this.renderView();
    };

    // Render view based on mode
    SalesListManager.prototype.renderView = function () {
        const tableView = document.getElementById('tableView');
        const groupedView = document.getElementById('groupedView');

        if (this.viewMode === 'table') {
            tableView.style.display = 'block';
            groupedView.style.display = 'none';
            groupedView.classList.remove('active');
            this.render(); // Use existing render method
        } else {
            tableView.style.display = 'none';
            groupedView.style.display = 'block';
            groupedView.classList.add('active');

            const filteredData = this.getFilteredData();

            if (this.viewMode === 'date') {
                this.renderDateGroupedView(filteredData);
            } else if (this.viewMode === 'genre') {
                this.renderGenreGroupedView(filteredData);
            }
        }
    };

    // Group data by date
    SalesListManager.prototype.groupByDate = function (data) {
        const groups = {
            '今日': [],
            '今週': [],
            '今月': [],
            '先月': [],
            'それ以前': [],
            '未接触': []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        data.forEach(item => {
            if (!item.lastContact) {
                groups['未接触'].push(item);
                return;
            }

            const contactDate = new Date(item.lastContact);

            if (contactDate >= today) {
                groups['今日'].push(item);
            } else if (contactDate >= weekStart) {
                groups['今週'].push(item);
            } else if (contactDate >= monthStart) {
                groups['今月'].push(item);
            } else if (contactDate >= lastMonthStart && contactDate <= lastMonthEnd) {
                groups['先月'].push(item);
            } else {
                groups['それ以前'].push(item);
            }
        });

        return groups;
    };

    // Group data by genre (industry)
    SalesListManager.prototype.groupByGenre = function (data) {
        const groups = {};

        data.forEach(item => {
            const industry = item.industry || 'その他';
            if (!groups[industry]) {
                groups[industry] = [];
            }
            groups[industry].push(item);
        });

        // Sort groups alphabetically
        const sortedGroups = {};
        Object.keys(groups).sort().forEach(key => {
            sortedGroups[key] = groups[key];
        });

        return sortedGroups;
    };

    // Render date-grouped view
    SalesListManager.prototype.renderDateGroupedView = function (data) {
        const groups = this.groupByDate(data);
        const groupedView = document.getElementById('groupedView');

        const groupOrder = ['今日', '今週', '今月', '先月', 'それ以前', '未接触'];
        const groupIcons = {
            '今日': '📅',
            '今週': '📆',
            '今月': '🗓️',
            '先月': '📋',
            'それ以前': '📁',
            '未接触': '❓'
        };

        groupedView.innerHTML = groupOrder
            .filter(groupName => groups[groupName].length > 0)
            .map(groupName => this.renderGroupSection(groupName, groups[groupName], groupIcons[groupName]))
            .join('');

        this.bindGroupEvents();
    };

    // Render genre-grouped view
    SalesListManager.prototype.renderGenreGroupedView = function (data) {
        const groups = this.groupByGenre(data);
        const groupedView = document.getElementById('groupedView');

        groupedView.innerHTML = Object.keys(groups)
            .map(groupName => this.renderGroupSection(groupName, groups[groupName], '🏢'))
            .join('');

        this.bindGroupEvents();
    };

    // Render a group section
    SalesListManager.prototype.renderGroupSection = function (groupName, items, icon) {
        const groupId = `group-${groupName.replace(/[^a-zA-Z0-9]/g, '-')}`;

        return `
            <div class="group-section">
                <div class="group-header" data-group="${groupId}">
                    <div class="group-title">
                        <span class="group-icon">${icon}</span>
                        <span>${groupName}</span>
                        <span class="group-count">${items.length}件</span>
                    </div>
                    <span class="group-toggle">▼</span>
                </div>
                <div class="group-content" id="${groupId}">
                    ${items.map(item => this.renderCompanyCard(item)).join('')}
                </div>
            </div>
        `;
    };

    // Render a company card
    SalesListManager.prototype.renderCompanyCard = function (item) {
        return `
            <div class="company-card">
                <div class="company-card-header">
                    <div>
                        <div class="company-name">${this.escapeHtml(item.companyName)}</div>
                        <div class="company-contact">${this.escapeHtml(item.contactPerson)}</div>
                    </div>
                    <div class="company-card-actions">
                        <button class="btn-action" onclick="app.editItem('${item.id}')" title="編集">
                            ✏️
                        </button>
                        <button class="btn-action" onclick="app.showDeleteConfirm('${item.id}')" title="削除">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="company-details">
                    ${item.phone ? `
                        <div class="company-detail">
                            <span class="company-detail-icon">📞</span>
                            <span class="company-detail-label">電話:</span>
                            <span class="company-detail-value">${this.escapeHtml(item.phone)}</span>
                        </div>
                    ` : ''}
                    ${item.email ? `
                        <div class="company-detail">
                            <span class="company-detail-icon">✉️</span>
                            <span class="company-detail-label">メール:</span>
                            <span class="company-detail-value">${this.escapeHtml(item.email)}</span>
                        </div>
                    ` : ''}
                    ${item.address ? `
                        <div class="company-detail">
                            <span class="company-detail-icon">📍</span>
                            <span class="company-detail-label">住所:</span>
                            <span class="company-detail-value">${this.escapeHtml(item.address)}</span>
                        </div>
                    ` : ''}
                    <div class="company-detail">
                        <span class="company-detail-icon">🏢</span>
                        <span class="company-detail-label">業種:</span>
                        <span class="company-detail-value">${this.escapeHtml(item.industry)}</span>
                    </div>
                    ${item.lastContact ? `
                        <div class="company-detail">
                            <span class="company-detail-icon">📅</span>
                            <span class="company-detail-label">最終接触:</span>
                            <span class="company-detail-value">${item.lastContact}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="company-card-footer">
                    <span class="status-badge ${item.status}">${item.status}</span>
                    <span class="prospect-badge ${item.prospectLevel}">${item.prospectLevel}</span>
                </div>
            </div>
        `;
    };

    // Bind group events (collapse/expand)
    SalesListManager.prototype.bindGroupEvents = function () {
        document.querySelectorAll('.group-header').forEach(header => {
            header.addEventListener('click', () => {
                const groupId = header.dataset.group;
                const content = document.getElementById(groupId);

                header.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
            });
        });
    };

    // Bind view mode button events
    SalesListManager.prototype.bindViewModeEvents = function () {
        document.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.view;
                this.setViewMode(mode);
            });
        });
    };

    // Override the original render method to support view modes
    const originalRender = SalesListManager.prototype.render;
    SalesListManager.prototype.render = function () {
        if (this.viewMode === 'table') {
            originalRender.call(this);
        } else {
            this.renderView();
        }
        this.updateStats();
    };

    // Initialize view mode on app start
    const originalInit = SalesListManager.prototype.init;
    SalesListManager.prototype.init = function () {
        originalInit.call(this);
        this.initViewMode();
        this.bindViewModeEvents();
    };
})();
