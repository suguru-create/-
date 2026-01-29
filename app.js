// ===== Data Management =====
class SalesListManager {
    constructor() {
        this.storageKey = 'salesListData';
        this.apiKeyStorageKey = 'googlePlacesApiKey';
        this.usageStorageKey = 'apiUsageData';
        this.data = this.loadData();
        this.currentEditId = null;
        this.currentDeleteId = null;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.searchResults = [];
        this.selectedResults = new Set();
        this.init();
    }

    init() {
        this.bindEvents();
        this.render();
        this.updateStats();
        this.populateIndustryFilter();
    }

    // ===== Local Storage Operations =====
    loadData() {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : [];
    }

    saveData() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }

    // ===== CRUD Operations =====
    addItem(item) {
        const newItem = {
            id: this.generateId(),
            ...item,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.data.push(newItem);
        this.saveData();
        this.render();
        this.updateStats();
        this.populateIndustryFilter();
    }

    updateItem(id, updates) {
        const index = this.data.findIndex(item => item.id === id);
        if (index !== -1) {
            this.data[index] = {
                ...this.data[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveData();
            this.render();
            this.updateStats();
            this.populateIndustryFilter();
        }
    }

    deleteItem(id) {
        this.data = this.data.filter(item => item.id !== id);
        this.saveData();
        this.render();
        this.updateStats();
        this.populateIndustryFilter();
    }

    getItem(id) {
        return this.data.find(item => item.id === id);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // ===== Filtering & Searching =====
    getFilteredData() {
        let filtered = [...this.data];

        // Search filter
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(item =>
                item.companyName.toLowerCase().includes(searchTerm) ||
                item.contactPerson.toLowerCase().includes(searchTerm) ||
                item.industry.toLowerCase().includes(searchTerm) ||
                (item.email && item.email.toLowerCase().includes(searchTerm)) ||
                (item.phone && item.phone.toLowerCase().includes(searchTerm))
            );
        }

        // Status filter
        const statusFilter = document.getElementById('statusFilter').value;
        if (statusFilter) {
            filtered = filtered.filter(item => item.status === statusFilter);
        }

        // Industry filter
        const industryFilter = document.getElementById('industryFilter').value;
        if (industryFilter) {
            filtered = filtered.filter(item => item.industry === industryFilter);
        }

        // Prospect level filter
        const prospectFilter = document.getElementById('prospectFilter').value;
        if (prospectFilter) {
            filtered = filtered.filter(item => item.prospectLevel === prospectFilter);
        }

        // Branch office filter
        const excludeBranches = document.getElementById('excludeBranchesFilter').checked;

        if (excludeBranches) {
            const branchKeywords = ['営業所', '支店', '出張所', 'サービスセンター', '営業部', '支社', '営業拠点'];

            filtered = filtered.filter(item => {
                const companyName = item.companyName;
                const address = item.address || '';
                const combinedText = companyName + ' ' + address;

                // Check if it contains branch keywords
                const isBranch = branchKeywords.some(keyword => combinedText.includes(keyword));

                // Exclude branches
                return !isBranch;
            });
        }


        // Sorting
        if (this.sortColumn) {
            filtered.sort((a, b) => {
                let aVal = a[this.sortColumn] || '';
                let bVal = b[this.sortColumn] || '';

                // Handle dates
                if (this.sortColumn === 'lastContact') {
                    aVal = aVal ? new Date(aVal) : new Date(0);
                    bVal = bVal ? new Date(bVal) : new Date(0);
                }

                if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }

    // ===== Rendering =====
    render() {
        const tbody = document.getElementById('tableBody');
        const emptyState = document.getElementById('emptyState');
        const filteredData = this.getFilteredData();

        if (filteredData.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.add('visible');
            return;
        }

        emptyState.classList.remove('visible');
        tbody.innerHTML = filteredData.map(item => this.renderRow(item)).join('');
    }

    renderRow(item) {
        const lastContact = item.lastContact
            ? new Date(item.lastContact).toLocaleDateString('ja-JP')
            : '未設定';

        const prospectLevel = item.prospectLevel || '未評価';
        const prospectIcon = {
            '脈あり': '🟢',
            '要フォロー': '🟡',
            '脈なし': '🔴',
            '未評価': '⚪'
        }[prospectLevel];

        return `
            <tr>
                <td><strong>${this.escapeHtml(item.companyName)}</strong></td>
                <td>${this.escapeHtml(item.contactPerson)}</td>
                <td>${this.escapeHtml(item.industry)}</td>
                <td><span class="status-badge ${item.status}">${item.status}</span></td>
                <td><span class="prospect-badge ${prospectLevel}">${prospectIcon} ${prospectLevel}</span></td>
                <td>${lastContact}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action" onclick="app.editItem('${item.id}')" title="編集">✏️</button>
                        <button class="btn-action" onclick="app.showDeleteConfirm('${item.id}')" title="削除">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== Statistics =====
    updateStats() {
        document.getElementById('totalCount').textContent = this.data.length;
        document.getElementById('untouchedCount').textContent =
            this.data.filter(item => item.status === '未接触').length;
        document.getElementById('negotiatingCount').textContent =
            this.data.filter(item => item.status === '商談中').length;
        document.getElementById('closedCount').textContent =
            this.data.filter(item => item.status === '成約').length;
        document.getElementById('hotProspectCount').textContent =
            this.data.filter(item => item.prospectLevel === '脈あり').length;
        document.getElementById('followUpCount').textContent =
            this.data.filter(item => item.prospectLevel === '要フォロー').length;
    }

    // ===== Industry Filter Population =====
    populateIndustryFilter() {
        const industries = [...new Set(this.data.map(item => item.industry))].sort();
        const select = document.getElementById('industryFilter');
        const currentValue = select.value;

        select.innerHTML = '<option value="">すべて</option>';
        industries.forEach(industry => {
            const option = document.createElement('option');
            option.value = industry;
            option.textContent = industry;
            select.appendChild(option);
        });

        select.value = currentValue;
    }

    // ===== Sorting =====
    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        this.updateSortIndicators();
        this.render();
    }

    updateSortIndicators() {
        document.querySelectorAll('.sort-indicator').forEach(indicator => {
            indicator.className = 'sort-indicator';
        });

        if (this.sortColumn) {
            const th = document.querySelector(`th[data-column="${this.sortColumn}"]`);
            if (th) {
                const indicator = th.querySelector('.sort-indicator');
                indicator.classList.add(this.sortDirection);
            }
        }
    }

    // ===== Modal Management =====
    openModal(title = '新規営業先追加') {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modal').classList.add('active');
    }

    closeModal() {
        document.getElementById('modal').classList.remove('active');
        document.getElementById('salesForm').reset();
        this.currentEditId = null;
    }

    openDeleteModal() {
        document.getElementById('deleteModal').classList.add('active');
    }

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.remove('active');
        this.currentDeleteId = null;
    }

    // ===== Form Handling =====
    handleSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = {
            companyName: formData.get('companyName'),
            contactPerson: formData.get('contactPerson'),
            phone: formData.get('phone') || '',
            email: formData.get('email') || '',
            address: formData.get('address') || '',
            industry: formData.get('industry'),
            status: formData.get('status'),
            prospectLevel: formData.get('prospectLevel'),
            lastContact: formData.get('lastContact') || '',
            notes: formData.get('notes') || ''
        };

        if (this.currentEditId) {
            this.updateItem(this.currentEditId, data);
        } else {
            this.addItem(data);
        }

        this.closeModal();
    }

    editItem(id) {
        const item = this.getItem(id);
        if (!item) return;

        this.currentEditId = id;
        this.openModal('営業先情報編集');

        // Populate form
        document.getElementById('companyName').value = item.companyName;
        document.getElementById('contactPerson').value = item.contactPerson;
        document.getElementById('phone').value = item.phone || '';
        document.getElementById('email').value = item.email || '';
        document.getElementById('address').value = item.address || '';
        document.getElementById('industry').value = item.industry;
        document.getElementById('status').value = item.status;
        document.getElementById('prospectLevel').value = item.prospectLevel || '未評価';
        document.getElementById('lastContact').value = item.lastContact || '';
        document.getElementById('notes').value = item.notes || '';
    }

    showDeleteConfirm(id) {
        this.currentDeleteId = id;
        this.openDeleteModal();
    }

    confirmDelete() {
        if (this.currentDeleteId) {
            this.deleteItem(this.currentDeleteId);
            this.closeDeleteModal();
        }
    }

    // ===== CSV Import Functionality =====
    importFromCSV() {
        const fileInput = document.getElementById('csvFileInput');
        fileInput.click();
    }

    handleCSVFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check file type
        if (!file.name.endsWith('.csv')) {
            alert('CSVファイルを選択してください。');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvContent = e.target.result;
                this.parseAndImportCSV(csvContent);
            } catch (error) {
                alert(`CSVファイルの読み込みに失敗しました: ${error.message}`);
            }
        };

        reader.onerror = () => {
            alert('ファイルの読み込み中にエラーが発生しました。');
        };

        reader.readAsText(file, 'UTF-8');

        // Reset file input
        event.target.value = '';
    }

    parseAndImportCSV(csvContent) {
        const lines = csvContent.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            alert('CSVファイルにデータが含まれていません。');
            return;
        }

        // Parse header
        const headers = this.parseCSVLine(lines[0]);

        // Validate headers
        const requiredHeaders = ['会社名', '担当者名', '業種'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
            alert(`必須項目が不足しています: ${missingHeaders.join(', ')}\n\nCSVファイルには以下のヘッダーが必要です:\n会社名,担当者名,電話番号,メールアドレス,住所,業種,ステータス,見込み度,最終接触日,メモ`);
            return;
        }

        // Parse data rows
        const results = {
            success: 0,
            skipped: 0,
            duplicates: [],
            errors: []
        };

        for (let i = 1; i < lines.length; i++) {
            try {
                const values = this.parseCSVLine(lines[i]);
                const rowData = {};

                headers.forEach((header, index) => {
                    rowData[header] = values[index] || '';
                });

                // Validate required fields
                if (!rowData['会社名'] || !rowData['担当者名'] || !rowData['業種']) {
                    results.errors.push({
                        line: i + 1,
                        error: '必須項目（会社名、担当者名、業種）が不足しています'
                    });
                    continue;
                }

                // Create item object
                const item = {
                    companyName: rowData['会社名'].trim(),
                    contactPerson: rowData['担当者名'].trim(),
                    phone: rowData['電話番号'] ? rowData['電話番号'].trim() : '',
                    email: rowData['メールアドレス'] ? rowData['メールアドレス'].trim() : '',
                    address: rowData['住所'] ? rowData['住所'].trim() : '',
                    industry: rowData['業種'].trim(),
                    status: rowData['ステータス'] ? rowData['ステータス'].trim() : '未接触',
                    prospectLevel: rowData['見込み度'] ? rowData['見込み度'].trim() : '未評価',
                    lastContact: rowData['最終接触日'] ? rowData['最終接触日'].trim() : '',
                    notes: rowData['メモ'] ? rowData['メモ'].trim() : ''
                };

                // Validate status
                const validStatuses = ['未接触', '商談中', '成約', '失注'];
                if (item.status && !validStatuses.includes(item.status)) {
                    item.status = '未接触';
                }

                // Validate prospect level
                const validProspectLevels = ['脈あり', '要フォロー', '脈なし', '未評価'];
                if (item.prospectLevel && !validProspectLevels.includes(item.prospectLevel)) {
                    item.prospectLevel = '未評価';
                }

                // Check for duplicates
                if (this.isDuplicate(item)) {
                    results.skipped++;
                    results.duplicates.push(item.companyName);
                    continue;
                }

                // Add item
                this.addItem(item);
                results.success++;

            } catch (error) {
                results.errors.push({
                    line: i + 1,
                    error: error.message
                });
            }
        }

        // Show results
        this.showImportResults(results);
    }

    // Check if item is duplicate
    isDuplicate(newItem) {
        return this.data.some(existingItem => {
            // Check 1: Exact company name match
            const nameMatch = existingItem.companyName.toLowerCase() === newItem.companyName.toLowerCase();

            // Check 2: Company name + address match (more strict)
            const addressMatch = existingItem.address && newItem.address &&
                existingItem.address.toLowerCase() === newItem.address.toLowerCase();

            // Check 3: Phone number match
            const phoneMatch = existingItem.phone && newItem.phone &&
                existingItem.phone.replace(/[^0-9]/g, '') === newItem.phone.replace(/[^0-9]/g, '');

            // Consider duplicate if:
            // - Name matches AND (address matches OR no address provided)
            // - OR phone number matches
            if (phoneMatch) return true;
            if (nameMatch && addressMatch) return true;
            if (nameMatch && !newItem.address && !existingItem.address) return true;

            return false;
        });
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current);
        return result;
    }

    showImportResults(results) {
        let message = `インポート完了\n\n`;
        message += `✅ 新規追加: ${results.success}件\n`;

        if (results.skipped > 0) {
            message += `⏭️ スキップ（重複）: ${results.skipped}件\n`;
        }

        if (results.errors.length > 0) {
            message += `❌ エラー: ${results.errors.length}件\n`;
        }

        // Show duplicate details
        if (results.duplicates.length > 0) {
            message += `\n重複した企業:\n`;
            results.duplicates.slice(0, 5).forEach(name => {
                message += `- ${name}\n`;
            });

            if (results.duplicates.length > 5) {
                message += `...他${results.duplicates.length - 5}件\n`;
            }
        }

        // Show error details
        if (results.errors.length > 0) {
            message += `\nエラー詳細:\n`;
            results.errors.slice(0, 5).forEach(error => {
                message += `行${error.line}: ${error.error}\n`;
            });

            if (results.errors.length > 5) {
                message += `\n...他${results.errors.length - 5}件のエラー`;
            }
        }

        alert(message);
    }

    // ===== Export Functionality =====
    exportToCSV() {
        const filteredData = this.getFilteredData();

        if (filteredData.length === 0) {
            alert('エクスポートするデータがありません。');
            return;
        }

        // CSV Headers
        const headers = [
            '会社名',
            '担当者名',
            '電話番号',
            'メールアドレス',
            '住所',
            '業種',
            'ステータス',
            '見込み度',
            '最終接触日',
            'メモ'
        ];

        // CSV Rows
        const rows = filteredData.map(item => [
            item.companyName,
            item.contactPerson,
            item.phone || '',
            item.email || '',
            item.address || '',
            item.industry,
            item.status,
            item.prospectLevel || '未評価',
            item.lastContact || '',
            item.notes || ''
        ]);

        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Add BOM for Excel UTF-8 support
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

        // Download
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `営業リスト_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ===== Event Binding =====
    bindEvents() {
        // Add button
        document.getElementById('addBtn').addEventListener('click', () => {
            this.openModal();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportToCSV();
        });

        // Import button
        document.getElementById('importBtn').addEventListener('click', () => {
            this.importFromCSV();
        });

        // CSV file input
        document.getElementById('csvFileInput').addEventListener('change', (e) => {
            this.handleCSVFile(e);
        });

        // Form submit
        document.getElementById('salesForm').addEventListener('submit', (e) => {
            this.handleSubmit(e);
        });

        // Modal close buttons
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        // Delete modal
        document.getElementById('closeDeleteModal').addEventListener('click', () => {
            this.closeDeleteModal();
        });

        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            this.closeDeleteModal();
        });

        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.confirmDelete();
        });

        // Close modal on background click
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });

        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target.id === 'deleteModal') {
                this.closeDeleteModal();
            }
        });

        // Search input
        document.getElementById('searchInput').addEventListener('input', () => {
            this.render();
        });

        // Filters
        document.getElementById('statusFilter').addEventListener('change', () => {
            this.render();
        });

        document.getElementById('industryFilter').addEventListener('change', () => {
            this.render();
        });

        document.getElementById('prospectFilter').addEventListener('change', () => {
            this.render();
        });

        // Branch office filter
        document.getElementById('excludeBranchesFilter').addEventListener('change', () => {
            this.render();
        });

        // Clear filters
        document.getElementById('clearFiltersBtn').addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            document.getElementById('statusFilter').value = '';
            document.getElementById('industryFilter').value = '';
            document.getElementById('prospectFilter').value = '';
            document.getElementById('excludeBranchesFilter').checked = false;
            this.render();
        });

        // Sortable columns
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.dataset.column;
                this.handleSort(column);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // ESC to close modals
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeDeleteModal();
            }

            // Ctrl/Cmd + K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
        });

        // ===== Google Places API Events =====

        // Search Places button
        document.getElementById('searchPlacesBtn').addEventListener('click', () => {
            this.openSearchModal();
        });

        // Close search modal
        document.getElementById('closeSearchModal').addEventListener('click', () => {
            this.closeSearchModal();
        });

        // Search modal background click
        document.getElementById('searchModal').addEventListener('click', (e) => {
            if (e.target.id === 'searchModal') {
                this.closeSearchModal();
            }
        });

        // Search form submit
        document.getElementById('searchPlacesForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.executeSearch();
        });

        // Add selected button
        document.getElementById('addSelectedBtn').addEventListener('click', () => {
            this.addSelectedPlaces();
        });

        // Select all button
        document.getElementById('selectAllBtn').addEventListener('click', () => {
            this.selectAllResults();
        });

        // Load more button
        document.getElementById('loadMoreBtn').addEventListener('click', () => {
            this.loadMoreResults();
        });


        // Open settings from warning
        document.getElementById('openSettingsFromWarning').addEventListener('click', (e) => {
            e.preventDefault();
            this.closeSearchModal();
            this.openSettingsModal();
        });

        // Close settings modal
        document.getElementById('closeSettingsModal').addEventListener('click', () => {
            this.closeSettingsModal();
        });

        // Settings modal background click
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.closeSettingsModal();
            }
        });

        // Save API key
        document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
            this.saveApiKey();
        });

        // Test API key
        document.getElementById('testApiKeyBtn').addEventListener('click', () => {
            this.testApiKey();
        });

        // Open API guide
        document.getElementById('openApiGuide').addEventListener('click', (e) => {
            e.preventDefault();
            alert('APIセットアップガイドは、プロジェクトフォルダの「api-setup-guide.md」をご覧ください。');
        });

        // Update keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // ESC to close all modals
            if (e.key === 'Escape') {
                this.closeSearchModal();
                this.closeSettingsModal();
            }
        });
    }

    // ===== Google Places API Methods =====

    openSearchModal() {
        const modal = document.getElementById('searchModal');
        modal.classList.add('active');

        // Check if API key is set
        if (!hasApiKey()) {
            document.getElementById('apiKeyWarning').style.display = 'flex';
            document.getElementById('searchPlacesForm').style.display = 'none';
        } else {
            document.getElementById('apiKeyWarning').style.display = 'none';
            document.getElementById('searchPlacesForm').style.display = 'block';
        }

        // Reset form and results
        document.getElementById('searchPlacesForm').reset();
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('noResults').style.display = 'none';
        document.getElementById('searchLoading').style.display = 'none';
        this.searchResults = [];
        this.selectedResults.clear();
    }

    closeSearchModal() {
        document.getElementById('searchModal').classList.remove('active');
    }

    async executeSearch() {
        const location = document.getElementById('searchLocation').value.trim();
        const keyword = document.getElementById('searchKeyword').value.trim();

        if (!location || !keyword) {
            alert('エリアと業種を入力してください。');
            return;
        }

        // Show loading
        document.getElementById('searchLoading').style.display = 'block';
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('noResults').style.display = 'none';

        try {
            const results = await searchPlaces(location, keyword);

            // Hide loading
            document.getElementById('searchLoading').style.display = 'none';

            if (results.length === 0) {
                document.getElementById('noResults').style.display = 'block';
            } else {
                this.searchResults = results;
                this.displaySearchResults(results);
            }
        } catch (error) {
            document.getElementById('searchLoading').style.display = 'none';
            alert(`検索エラー: ${error.message}\n\nAPIキーが正しく設定されているか確認してください。`);
        }
    }

    displaySearchResults(results) {
        const resultsList = document.getElementById('resultsList');
        resultsList.innerHTML = '';

        results.forEach((place, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.innerHTML = `
                <div class="result-header">
                    <input type="checkbox" class="result-checkbox" data-index="${index}">
                    <div class="result-info">
                        <div class="result-name">${place.name}</div>
                        ${place.rating > 0 ? `
                            <div class="result-rating">
                                ⭐ ${place.rating} (${place.userRatingsTotal}件)
                            </div>
                        ` : ''}
                        <div class="result-details">
                            <div class="result-detail">
                                <span class="result-detail-icon">📍</span>
                                <span>${place.address}</span>
                            </div>
                            ${place.distance !== undefined ? `
                                <div class="result-detail">
                                    <span class="result-detail-icon">📏</span>
                                    <span>検索地点から ${place.distance.toFixed(1)}km</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;

            // Add click handler
            const checkbox = resultItem.querySelector('.result-checkbox');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedResults.add(index);
                    resultItem.classList.add('selected');
                } else {
                    this.selectedResults.delete(index);
                    resultItem.classList.remove('selected');
                }
                this.updateSelectedCount();
            });

            resultItem.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            resultsList.appendChild(resultItem);
        });

        document.getElementById('resultsCount').textContent = results.length;
        document.getElementById('searchResults').style.display = 'block';
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        const count = this.selectedResults.size;
        document.getElementById('selectedCount').textContent = count;
        document.getElementById('addSelectedBtn').disabled = count === 0;
    }

    async addSelectedPlaces() {
        if (this.selectedResults.size === 0) return;

        let addedCount = 0;
        let skippedCount = 0;

        for (const index of this.selectedResults) {
            const place = this.searchResults[index];

            // Map types to industry
            const industry = this.mapTypesToIndustry(place.types);

            const item = {
                companyName: place.name,
                contactPerson: '', // Will be filled manually
                phone: '',
                email: '',
                address: place.address,
                industry: industry,
                status: '未接触',
                prospectLevel: '未評価',
                lastContact: '',
                notes: `評価: ${place.rating > 0 ? `⭐${place.rating} (${place.userRatingsTotal}件)` : 'なし'}`
            };

            // Check for duplicates
            if (this.isDuplicate(item)) {
                skippedCount++;
            } else {
                this.addItem(item);
                addedCount++;
            }
        }

        // Show results
        let message = `インポート完了\n\n`;
        message += `✅ 新規追加: ${addedCount}件\n`;
        if (skippedCount > 0) {
            message += `⏭️ スキップ（重複）: ${skippedCount}件\n`;
        }
        alert(message);

        // Close modal
        this.closeSearchModal();
    }

    // Select all search results (toggle)
    selectAllResults() {
        // Check if all results are already selected
        const allSelected = this.searchResults.every((_, index) => this.selectedResults.has(index));

        if (allSelected) {
            // Deselect all
            this.selectedResults.clear();
        } else {
            // Select all current results
            this.searchResults.forEach((_, index) => {
                this.selectedResults.add(index);
            });
        }

        // Update UI
        this.updateSelectedCount();
        this.updateCheckboxes();
    }

    // Update checkboxes to match selected state
    updateCheckboxes() {
        const checkboxes = document.querySelectorAll('.result-checkbox');
        checkboxes.forEach((checkbox, index) => {
            checkbox.checked = this.selectedResults.has(index);
            const resultItem = checkbox.closest('.result-item');
            if (checkbox.checked) {
                resultItem.classList.add('selected');
            } else {
                resultItem.classList.remove('selected');
            }
        });
    }

    // Load more results (trigger next page if available)
    async loadMoreResults() {
        // This will be implemented with pagination support
        // For now, show a message
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        loadMoreBtn.disabled = true;
        loadMoreBtn.innerHTML = '<span class="btn-icon">⏳</span> 読み込み中...';

        try {
            // Re-execute search to get more results
            // The search function already handles pagination
            await this.executeSearch(true); // Pass true to append results
        } catch (error) {
            alert('さらに読み込みに失敗しました: ' + error.message);
        } finally {
            loadMoreBtn.disabled = false;
            loadMoreBtn.innerHTML = '<span class="btn-icon">⬇️</span> さらに読み込む';
        }
    }


    mapTypesToIndustry(types) {
        const industryMap = {
            // 建築
            'general_contractor': '建築',
            'roofing_contractor': '建築',
            'electrician': '建築',
            'plumber': '建築',
            'painter': '建築',
            'home_improvement_store': '建築',

            // 運送
            'moving_company': '運送',
            'logistics': '運送',
            'courier_service': '運送',
            'trucking_company': '運送',

            // 現場
            'construction_company': '現場',
            'excavating_contractor': '現場',
            'demolition_contractor': '現場',

            // 医療・介護
            'hospital': '医療・介護',
            'doctor': '医療・介護',
            'dentist': '医療・介護',
            'pharmacy': '医療・介護',
            'physiotherapist': '医療・介護',
            'nursing_home': '医療・介護',
            'health': '医療・介護',
            'medical_clinic': '医療・介護',

            // 飲食・サービス
            'restaurant': '飲食・サービス',
            'cafe': '飲食・サービス',
            'bar': '飲食・サービス',
            'meal_takeaway': '飲食・サービス',
            'meal_delivery': '飲食・サービス',
            'bakery': '飲食・サービス',
            'beauty_salon': '飲食・サービス',
            'hair_care': '飲食・サービス',
            'spa': '飲食・サービス',
            'gym': '飲食・サービス',
            'laundry': '飲食・サービス',
            'car_wash': '飲食・サービス',

            // 製造・工場
            'factory': '製造・工場',
            'manufacturer': '製造・工場',
            'industrial': '製造・工場',
            'warehouse': '製造・工場',

            // 食品工場
            'food_processing': '食品工場',
            'food_manufacturer': '食品工場',
            'brewery': '食品工場',
            'winery': '食品工場'
        };

        for (const type of types) {
            if (industryMap[type]) {
                return industryMap[type];
            }
        }

        return 'その他';
    }

    // Settings Modal
    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.add('active');

        // Load current API key
        const apiKey = getApiKey();
        document.getElementById('apiKeyInput').value = apiKey;

        // Update usage display
        updateUsageDisplay();

        // Hide status
        document.getElementById('apiKeyStatus').style.display = 'none';
    }

    closeSettingsModal() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    saveApiKey() {
        const apiKey = document.getElementById('apiKeyInput').value.trim();

        if (!apiKey) {
            alert('APIキーを入力してください。');
            return;
        }

        saveApiKey(apiKey);

        const statusDiv = document.getElementById('apiKeyStatus');
        statusDiv.className = 'api-status success';
        statusDiv.textContent = 'APIキーを保存しました。';
        statusDiv.style.display = 'block';

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }

    async testApiKey() {
        const apiKey = document.getElementById('apiKeyInput').value.trim();

        if (!apiKey) {
            alert('APIキーを入力してください。');
            return;
        }

        const statusDiv = document.getElementById('apiKeyStatus');
        statusDiv.textContent = 'テスト中...';
        statusDiv.className = 'api-status';
        statusDiv.style.display = 'block';

        const result = await testApiKey(apiKey);

        if (result.success) {
            statusDiv.className = 'api-status success';
        } else {
            statusDiv.className = 'api-status error';
        }
        statusDiv.textContent = result.message;
    }
}

// ===== Initialize App =====
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SalesListManager();

    // Add some sample data if empty (for demo purposes)
    if (app.data.length === 0) {
        const sampleData = [
            {
                companyName: '株式会社サンプル商事',
                contactPerson: '山田太郎',
                phone: '03-1234-5678',
                email: 'yamada@sample.co.jp',
                address: '東京都千代田区丸の内1-1-1',
                industry: '製造・工場',
                status: '商談中',
                prospectLevel: '脈あり',
                lastContact: '2026-01-25',
                notes: '次回訪問予定: 2月上旬'
            },
            {
                companyName: 'テスト株式会社',
                contactPerson: '佐藤花子',
                phone: '06-9876-5432',
                email: 'sato@test.co.jp',
                address: '大阪府大阪市北区梅田2-2-2',
                industry: '建築',
                status: '未接触',
                prospectLevel: '未評価',
                lastContact: '',
                notes: ''
            },
            {
                companyName: 'デモ企業株式会社',
                contactPerson: '鈴木一郎',
                phone: '052-1111-2222',
                email: 'suzuki@demo.co.jp',
                address: '愛知県名古屋市中区栄3-3-3',
                industry: '飲食・サービス',
                status: '成約',
                prospectLevel: '脈あり',
                lastContact: '2026-01-20',
                notes: '契約締結済み。次回フォローアップ: 3月'
            }
        ];

        sampleData.forEach(data => app.addItem(data));
    }
});
