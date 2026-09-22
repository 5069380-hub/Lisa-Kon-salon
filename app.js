import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Конфигурация Firebase с вашим API-ключом
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

let appData = { staff: [], expenses: [], transactions: [] };
let financeChartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadDataFromFirebase();
        document.getElementById('txDate').valueAsDate = new Date();
        initApp();
        setupFormsHandlers();
    } catch (error) {
        console.error("Error loading data:", error);
    }
});

async function loadDataFromFirebase() {
    const staffSnapshot = await getDocs(collection(db, "staff"));
    appData.staff = staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const expensesSnapshot = await getDocs(collection(db, "expenses"));
    appData.expenses = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const txSnapshot = await getDocs(collection(db, "transactions"));
    appData.transactions = txSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function initApp() {
    const { staff, transactions, expenses } = appData;

    const masterSelect = document.getElementById('txMaster');
    masterSelect.innerHTML = '';
    if (staff.length === 0) {
        masterSelect.innerHTML = `<option value="" disabled selected>No masters available</option>`;
    } else {
        staff.forEach(s => {
            masterSelect.innerHTML += `<option value="${s.name}">${s.name}</option>`;
        });
    }

    let totalRevenue = 0;
    let totalPayroll = 0;
    let revToday = 0;
    let revMonth = 0;
    let revYear = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.substring(0, 7); 
    const currentYearPrefix = todayStr.substring(0, 4);   

    const staffContainer = document.getElementById('staffCardsContainer');
    staffContainer.innerHTML = '';

    if (staff.length === 0) {
        staffContainer.innerHTML = `<div class="col-12 text-muted text-center py-3">No masters added yet. Click "+ New Master" to add your first employee.</div>`;
    }

    staff.forEach(employee => {
        let masterRevenue = 0;
        transactions.forEach(tx => {
            if (tx.master === employee.name) {
                masterRevenue += Number(tx.amount);
            }
        });

        const masterPayout = (masterRevenue * Number(employee.servicePercent)) / 100;
        totalRevenue += masterRevenue;
        totalPayroll += masterPayout;

        staffContainer.innerHTML += `
            <div class="col-md-4 mb-3">
                <div class="card shadow-sm border-0 p-3 h-100">
                    <div class="d-flex align-items-center mb-3">
                        <img src="${employee.photo}" class="master-avatar me-3" alt="${employee.name}">
                        <div>
                            <h5 class="mb-1">${employee.name}</h5>
                            <p class="text-muted mb-0 small">Phone: ${employee.phone}</p>
                            <p class="text-muted mb-0 small">Age: ${employee.age}</p>
                        </div>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-between mb-1">
                        <span>Commission Rate:</span>
                        <strong>${employee.servicePercent}%</strong>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span>Master Revenue:</span>
                        <strong class="text-success">$${masterRevenue.toLocaleString()}</strong>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span>Payout:</span>
                        <strong class="text-danger">$${Math.round(masterPayout).toLocaleString()}</strong>
                    </div>
                </div>
            </div>
        `;
    });

    transactions.forEach(tx => {
        if (tx.date === todayStr) revToday += Number(tx.amount);
        if (tx.date.startsWith(currentMonthPrefix)) revMonth += Number(tx.amount);
        if (tx.date.startsWith(currentYearPrefix)) revYear += Number(tx.amount);
    });

    let totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    let netProfit = totalRevenue - totalPayroll - totalExpenses;

    document.getElementById('totalRevenue').innerText = '$' + totalRevenue.toLocaleString();
    document.getElementById('totalPayroll').innerText = '$' + Math.round(totalPayroll).toLocaleString();
    document.getElementById('totalExpenses').innerText = '$' + totalExpenses.toLocaleString();
    document.getElementById('netProfit').innerText = '$' + Math.round(netProfit).toLocaleString();

    document.getElementById('revToday').innerText = '$' + revToday.toLocaleString();
    document.getElementById('revMonth').innerText = '$' + revMonth.toLocaleString();
    document.getElementById('revYear').innerText = '$' + revYear.toLocaleString();

    const txTbody = document.querySelector('#transactionsTable tbody');
    txTbody.innerHTML = '';
    if (transactions.length === 0) {
        txTbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No transactions recorded yet</td></tr>`;
    } else {
        transactions.forEach(tx => {
            txTbody.innerHTML += `
                <tr>
                    <td>${tx.date}</td>
                    <td>${tx.master}</td>
                    <td>${tx.client}</td>
                    <td>${tx.item}</td>
                    <td>$${Number(tx.amount).toLocaleString()}</td>
                    <td><span class="badge bg-secondary">${tx.type}</span></td>
                </tr>
            `;
        });
    }

    updateChart(totalRevenue, totalPayroll, totalExpenses, netProfit);
}

function setupFormsHandlers() {
    document.getElementById('masterForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newMaster = {
            name: document.getElementById('masterName').value,
            phone: document.getElementById('masterPhone').value,
            age: Number(document.getElementById('masterAge').value),
            photo: document.getElementById('masterPhoto').value,
            servicePercent: Number(document.getElementById('masterPercent').value)
        };

        try {
            const docRef = await addDoc(collection(db, "staff"), newMaster);
            appData.staff.push({ id: docRef.id, ...newMaster });
            
            const modalEl = document.getElementById('addMasterModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modalInstance.hide();
            
            initApp();
            e.target.reset();
        } catch (error) {
            console.error("Error adding master:", error);
            alert("Failed to save master to database.");
        }
    });

    document.getElementById('transactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newTx = {
            date: document.getElementById('txDate').value,
            master: document.getElementById('txMaster').value,
            client: document.getElementById('txClient').value,
            item: document.getElementById('txItem').value,
            amount: parseFloat(document.getElementById('txAmount').value),
            type: document.getElementById('txType').value
        };

        try {
            const docRef = await addDoc(collection(db, "transactions"), newTx);
            appData.transactions.push({ id: docRef.id, ...newTx });
            
            const modalEl = document.getElementById('addTransactionModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modalInstance.hide();
            
            initApp();
            e.target.reset();
            document.getElementById('txDate').valueAsDate = new Date();
        } catch (error) {
            console.error("Error adding transaction:", error);
            alert("Failed to save transaction to database.");
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
                label: 'Amount in USD',
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
