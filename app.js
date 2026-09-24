import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDablK3aI7Yf15TwYXAhl_OBJaIg1RMgqo",
    authDomain: "lisa-kon-salon.firebaseapp.com",
    projectId: "lisa-kon-salon",
    storageBucket: "lisa-kon-salon.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentSalon = localStorage.getItem('selectedSalon') || null;
let appData = { staff: [], transactions: [], services: [], expenseCategories: [] };
let financeChartInstance = null;
let currentCalendarDate = new Date();
let selectedActiveDateStr = '';

document.addEventListener("DOMContentLoaded", async () => {
    checkSalonSelection();
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('txDateTime').value = now.toISOString().slice(0, 16);

    document.getElementById('recordTypeSelector').addEventListener('change', (e) => {
        const isService = e.target.value === 'Service';
        document.getElementById('serviceFieldsContainer').style.display = isService ? 'block' : 'none';
        document.getElementById('expenseFieldsContainer').style.display = isService ? 'none' : 'block';
    });

    document.getElementById('changeSalonBtn').addEventListener('click', () => {
        localStorage.removeItem('selectedSalon');
        location.reload();
    });

    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    document.getElementById('currentMonthBtn').addEventListener('click', () => {
        currentCalendarDate = new Date();
        renderCalendar();
    });

    setupSalonButtons();
    setupFormHandlers();
});

function checkSalonSelection() {
    const modalEl = document.getElementById('salonSelectModal');
    const modal = new bootstrap.Modal(modalEl);

    if (!currentSalon) {
        modal.show();
    } else {
        document.getElementById('currentSalonTitle').innerText = currentSalon;
        loadAppData();
    }
}

function setupSalonButtons() {
    document.querySelectorAll('.salon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentSalon = btn.getAttribute('data-salon');
            localStorage.setItem('selectedSalon', currentSalon);
            document.getElementById('currentSalonTitle').innerText = currentSalon;
            const modalEl = document.getElementById('salonSelectModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            loadAppData();
        });
    });
}

async function loadAppData() {
    try {
        const staffSnap = await getDocs(collection(db, "staff"));
        appData.staff = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const txSnap = await getDocs(collection(db, "transactions"));
        appData.transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(t => t.salon === currentSalon);

        const srvSnap = await getDocs(collection(db, "services"));
        appData.services = srvSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const expCatSnap = await getDocs(collection(db, "expenseCategories"));
        appData.expenseCategories = expCatSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        renderApp();
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

function renderApp() {
    renderDropdowns();
    renderStaffCards();
    renderConfigLists();
    calculateAndRenderFinancials();
    renderCalendar();
}

function renderDropdowns() {
    const masterSelect = document.getElementById('txMaster');
    masterSelect.innerHTML = appData.staff.length ? '' : '<option disabled selected>No masters available</option>';
    appData.staff.forEach(s => {
        masterSelect.innerHTML += `<option value="${s.name}">${s.name}</option>`;
    });

    const srvContainer = document.getElementById('servicesCheckboxesContainer');
    srvContainer.innerHTML = appData.services.length ? '' : '<span class="text-muted small">No services configured</span>';
    appData.services.forEach((srv, index) => {
        srvContainer.innerHTML += `
            <div class="service-checkbox-item d-flex justify-content-between align-items-center">
                <div class="form-check">
                    <input class="form-check-input service-chk" type="checkbox" value="${srv.name}" data-price="${srv.price}" id="srv_${index}">
                    <label class="form-check-label fw-bold" for="srv_${index}">${srv.name}</label>
                </div>
                <span class="text-success">$${srv.price}</span>
            </div>
        `;
    });

    document.querySelectorAll('.service-chk').forEach(chk => {
        chk.addEventListener('change', updateCalculatedAmount);
    });

    const expCatSelect = document.getElementById('txExpenseCategory');
    expCatSelect.innerHTML = appData.expenseCategories.length ? '' : '<option disabled selected>No categories available</option>';
    appData.expenseCategories.forEach(cat => {
        expCatSelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });
}

function updateCalculatedAmount() {
    let total = 0;
    document.querySelectorAll('.service-chk:checked').forEach(chk => {
        total += Number(chk.dataset.price);
    });
    document.getElementById('txAmount').value = total;
}

function renderCalendar() {
    const container = document.getElementById('calendarDaysContainer');
    container.innerHTML = '';

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('calendarMonthTitle').innerText = `${monthNames[month]} ${year}`;

    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday start
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    // Empty cells for previous month offset
    for (let i = 0; i < firstDayIndex; i++) {
        container.innerHTML += `<div class="calendar-cell bg-light opacity-50"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month + 1).padStart(2, '0');
        const dateString = `${year}-${monthStr}-${dayStr}`;

        let dayRev = 0;
        appData.transactions.forEach(t => {
            if (t.dateTime.startsWith(dateString) && t.type === 'Service') {
                dayRev += Number(t.amount);
            }
        });

        const hasData = dayRev > 0 ? 'has-data' : '';
        const isToday = dateString === todayStr ? 'today' : '';

        container.innerHTML += `
            <div class="calendar-cell ${hasData} ${isToday}" onclick="openDayDetails('${dateString}')">
                <div class="day-number">${day}</div>
                ${dayRev > 0 ? `<div class="day-stats">+$${dayRev.toLocaleString()}</div>` : ''}
            </div>
        `;
    }
}

window.openDayDetails = function(dateStr) {
    selectedActiveDateStr = dateStr;
    document.getElementById('modalDateTitle').innerText = dateStr;

    // Set modal transaction date default
    document.getElementById('txDateTime').value = `${dateStr}T12:00`;

    const tbody = document.querySelector('#dayTransactionsTable tbody');
    tbody.innerHTML = '';

    const dayTx = appData.transactions.filter(t => t.dateTime.startsWith(dateStr));
    let dayTotal = 0;

    if (!dayTx.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No records for this day</td></tr>`;
    } else {
        dayTx.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime)).forEach(t => {
            if (t.type === 'Service') dayTotal += Number(t.amount);
            const badge = t.type === 'Service' ? '<span class="badge bg-success">Service</span>' : '<span class="badge bg-warning text-dark">Expense</span>';
            tbody.innerHTML += `
                <tr>
                    <td>${t.dateTime.split('T')[1]}</td>
                    <td>${t.master || t.category || '-'}</td>
                    <td>${t.service || t.category || '-'}</td>
                    <td>$${Number(t.amount).toLocaleString()}</td>
                    <td>${badge}</td>
                </tr>
            `;
        });
    }

    document.getElementById('modalDayTotal').innerText = '$' + dayTotal.toLocaleString();
    
    const dayModal = new bootstrap.Modal(document.getElementById('dayDetailModal'));
    dayModal.show();
};

function renderStaffCards() {
    const container = document.getElementById('staffCardsContainer');
    container.innerHTML = '';
    if (!appData.staff.length) {
        container.innerHTML = `<div class="col-12 text-muted text-center py-3">No masters added yet. Click "+ New Master".</div>`;
        return;
    }

    appData.staff.forEach(emp => {
        let rev = 0;
        appData.transactions.forEach(t => {
            if (t.type === 'Service' && t.master === emp.name) rev += Number(t.amount);
        });
        const payout = (rev * Number(emp.servicePercent)) / 100;

        container.innerHTML += `
            <div class="col-md-4">
                <div class="card shadow-sm border-0 p-3 h-100">
                    <div class="d-flex align-items-center mb-3">
                        <img src="${emp.photo}" class="master-avatar me-3">
                        <div>
                            <h5 class="mb-1">${emp.name}</h5>
                            <p class="text-muted mb-0 small">Phone: ${emp.phone}</p>
                        </div>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-between mb-1"><span>Commission:</span><strong>${emp.servicePercent}%</strong></div>
                    <div class="d-flex justify-content-between mb-1"><span>Master Revenue:</span><strong class="text-success">$${rev.toLocaleString()}</strong></div>
                    <div class="d-flex justify-content-between"><span>Payout:</span><strong class="text-danger">$${Math.round(payout).toLocaleString()}</strong></div>
                </div>
            </div>
        `;
    });
}

function renderConfigLists() {
    const srvList = document.getElementById('servicesListContainer');
    srvList.innerHTML = appData.services.length ? '' : '<li class="list-group-item text-muted">No services added</li>';
    appData.services.forEach(s => {
        srvList.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">${s.name} <strong>$${s.price}</strong> <button class="btn btn-sm btn-outline-danger" onclick="deleteItem('services', '${s.id}')">Delete</button></li>`;
    });

    const expList = document.getElementById('expenseCatListContainer');
    expList.innerHTML = appData.expenseCategories.length ? '' : '<li class="list-group-item text-muted">No categories added</li>';
    appData.expenseCategories.forEach(c => {
        expList.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">${c.name} <button class="btn btn-sm btn-outline-danger" onclick="deleteItem('expenseCategories', '${c.id}')">Delete</button></li>`;
    });
}

window.deleteItem = async function(colName, id) {
    if (confirm("Are you sure you want to delete this item?")) {
        await deleteDoc(doc(db, colName, id));
        loadAppData();
    }
};

function calculateAndRenderFinancials() {
    let totalRev = 0;
    let totalPayroll = 0;
    let totalExp = 0;
    let revToday = 0;
    let revMonth = 0;
    let revYear = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const monthPrefix = todayStr.substring(0, 7);
    const yearPrefix = todayStr.substring(0, 4);

    appData.staff.forEach(emp => {
        let empRev = 0;
        appData.transactions.forEach(t => {
            if (t.type === 'Service' && t.master === emp.name) empRev += Number(t.amount);
        });
        totalPayroll += (empRev * Number(emp.servicePercent)) / 100;
    });

    appData.transactions.forEach(t => {
        const datePart = t.dateTime.split('T')[0];
        if (t.type === 'Service') {
            totalRev += Number(t.amount);
            if (datePart === todayStr) revToday += Number(t.amount);
            if (datePart.startsWith(monthPrefix)) revMonth += Number(t.amount);
            if (datePart.startsWith(yearPrefix)) revYear += Number(t.amount);
        } else if (t.type === 'Expense') {
            totalExp += Number(t.amount);
        }
    });

    const netProfit = totalRev - totalPayroll - totalExp;

    document.getElementById('totalRevenue').innerText = '$' + totalRev.toLocaleString();
    document.getElementById('totalPayroll').innerText = '$' + Math.round(totalPayroll).toLocaleString();
    document.getElementById('totalExpenses').innerText = '$' + totalExp.toLocaleString();
    document.getElementById('netProfit').innerText = '$' + Math.round(netProfit).toLocaleString();

    document.getElementById('revToday').innerText = '$' + revToday.toLocaleString();
    document.getElementById('revMonth').innerText = '$' + revMonth.toLocaleString();
    document.getElementById('revYear').innerText = '$' + revYear.toLocaleString();

    updateChart(totalRev, totalPayroll, totalExp, netProfit);
}

function setupFormHandlers() {
    document.getElementById('masterForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newMaster = {
            name: document.getElementById('masterName').value,
            phone: document.getElementById('masterPhone').value,
            photo: document.getElementById('masterPhoto').value,
            servicePercent: Number(document.getElementById('masterPercent').value)
        };
        try {
            await addDoc(collection(db, "staff"), newMaster);
            bootstrap.Modal.getInstance(document.getElementById('addMasterModal')).hide();
            e.target.reset();
            loadAppData();
        } catch (err) {
            console.error("Error saving master:", err);
            alert("Failed to save master.");
        }
    });

    document.getElementById('addServiceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newSrv = {
            name: document.getElementById('serviceNameInput').value,
            price: Number(document.getElementById('servicePriceInput').value)
        };
        await addDoc(collection(db, "services"), newSrv);
        e.target.reset();
        loadAppData();
    });

    document.getElementById('addExpenseCatForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newCat = { name: document.getElementById('expenseCatNameInput').value };
        await addDoc(collection(db, "expenseCategories"), newCat);
        e.target.reset();
        loadAppData();
    });

    document.getElementById('transactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('recordTypeSelector').value;
        const record = {
            salon: currentSalon,
            type: type,
            dateTime: document.getElementById('txDateTime').value,
            amount: parseFloat(document.getElementById('txAmount').value)
        };

        if (type === 'Service') {
            record.master = document.getElementById('txMaster').value;
            let checkedServices = [];
            document.querySelectorAll('.service-chk:checked').forEach(chk => {
                checkedServices.push(chk.value);
            });
            record.service = checkedServices.length ? checkedServices.join(', ') : 'Custom Service';
        } else {
            record.category = document.getElementById('txExpenseCategory').value;
        }

        try {
            await addDoc(collection(db, "transactions"), record);
            bootstrap.Modal.getInstance(document.getElementById('addTransactionModal')).hide();
            loadAppData();
            if (selectedActiveDateStr) {
                openDayDetails(selectedActiveDateStr);
            }
        } catch (err) {
            console.error("Error saving transaction:", err);
            alert("Failed to save transaction.");
        }
    });
}

function updateChart(rev, payroll, exp, profit) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    if (financeChartInstance) financeChartInstance.destroy();

    financeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Revenue', 'Payroll', 'Expenses', 'Profit'],
            datasets: [{
                data: [rev, payroll, exp, profit],
                backgroundColor: ['#198754', '#dc3545', '#ffc107', '#0d6efd']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });
}
