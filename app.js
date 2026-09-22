import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Вставьте сюда ваши ключи из Firebase (Project Settings -> Web App)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
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
        console.error("Ошибка загрузки данных:", error);
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
    staff.forEach(s => {
        masterSelect.innerHTML += `<option value="${s.name}">${s.name}</option>`;
    });

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
        staffContainer.innerHTML = `<div class="col-12 text-muted text-center py-3">Пока нет добавленных мастеров. Нажмите «+ Новый мастер», чтобы добавить первого сотрудника.</div>`;
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
                            <p class="text-muted mb-0 small">Тел: ${employee.phone}</p>
                            <p class="text-muted mb-0 small">Возраст: ${employee.age} лет</p>
                        </div>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-between mb-1">
                        <span>Ставка %:</span>
                        <strong>${employee.servicePercent}%</strong>
                    </div>
                    <div class="d-flex justify-content-between mb-1">
                        <span>Выручка мастера:</span>
                        <strong class="text-success">${masterRevenue.toLocaleString()} ₽</strong>
                    </div>
                    <div class="d-flex justify-content-between">
                        <span>Зарплата к выплате:</span>
                        <strong class="text-danger">${Math.round(masterPayout).toLocaleString()} ₽</strong>
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

    document.getElementById('totalRevenue').innerText = totalRevenue.toLocaleString() + ' ₽';
    document.getElementById('totalPayroll').innerText = Math.round(totalPayroll).toLocaleString() + ' ₽';
    document.getElementById('totalExpenses').innerText = totalExpenses.toLocaleString() + ' ₽';
    document.getElementById('netProfit').innerText = Math.round(netProfit).toLocaleString() + ' ₽';

    document.getElementById('revToday').innerText = revToday.toLocaleString() + ' ₽';
    document.getElementById('revMonth').innerText = revMonth.toLocaleString() + ' ₽';
    document.getElementById('revYear').innerText = revYear.toLocaleString() + ' ₽';

    const txTbody = document.querySelector('#transactionsTable tbody');
    txTbody.innerHTML = '';
    transactions.forEach(tx => {
        txTbody.innerHTML += `
            <tr>
                <td>${tx.date}</td>
                <td>${tx.master}</td>
                <td>${tx.client}</td>
                <td>${tx.item}</td>
                <td>${Number(tx.amount).toLocaleString()} ₽</td>
                <td><span class="badge bg-secondary">${tx.type}</span></td>
            </tr>
        `;
    });

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
            await addDoc(collection(db, "staff"), newMaster);
            appData.staff.push(newMaster);
            bootstrap.Modal.getInstance(document.getElementById('addMasterModal')).hide();
            initApp();
            e.target.reset();
        } catch (error) {
            console.error("Ошибка добавления мастера:", error);
            alert("Не удалось сохранить мастера в базу.");
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
            await addDoc(collection(db, "transactions"), newTx);
            appData.transactions.push(newTx);
            bootstrap.Modal.getInstance(document.getElementById('addTransactionModal')).hide();
            initApp();
            e.target.reset();
            document.getElementById('txDate').valueAsDate = new Date();
        } catch (error) {
            console.error("Ошибка добавления операции:", error);
            alert("Не удалось сохранить запись в базу данных.");
        }
    });
}

function updateChart(rev, payroll, exp, profit) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    if (financeChartInstance) financeChartInstance.destroy();

    financeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Выручка', 'Зарплаты', 'Расходы', 'Прибыль'],
            datasets: [{
                label: 'Сумма в рублях',
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
