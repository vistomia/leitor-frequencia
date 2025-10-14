// Sistema de Presença NFC
let ndefReader = null;
let isFrequencyActive = false;
let currentSerial = null;

// Dados armazenados no localStorage
const STUDENTS_KEY = 'nfc_students';
const PRESENCE_KEY = 'nfc_presence';

// Inicializar sistema
document.addEventListener('DOMContentLoaded', function() {
    loadStudentsList();
    loadTodaysPresence();
    updateFrequencyStatus();
});

// Gerenciamento de dados
function getStudents() {
    const students = localStorage.getItem(STUDENTS_KEY);
    return students ? JSON.parse(students) : {};
}

function saveStudents(students) {
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
}

function getTodaysPresence() {
    const today = new Date().toDateString();
    const presence = localStorage.getItem(PRESENCE_KEY);
    const allPresence = presence ? JSON.parse(presence) : {};
    return allPresence[today] || {};
}

function saveTodaysPresence(presence) {
    const today = new Date().toDateString();
    const allPresence = JSON.parse(localStorage.getItem(PRESENCE_KEY) || '{}');
    allPresence[today] = presence;
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(allPresence));
}

// Iniciar sistema de frequência
async function startFrequency() {
    if (!('NDEFReader' in window)) {
        showMessage('NFC não é suportado neste dispositivo/navegador', 'error');
        return;
    }

    try {
        ndefReader = new NDEFReader();
        await ndefReader.scan();
        
        isFrequencyActive = true;
        updateFrequencyStatus();
        showMessage('Sistema ativo. Aproxime os cartões NFC.', 'success');
        
        ndefReader.addEventListener("reading", handleNFCReading);
        ndefReader.addEventListener("readingerror", handleNFCError);
        
    } catch (error) {
        console.error('Erro ao iniciar NFC:', error);
        showMessage(`Erro: ${error.message}`, 'error');
        
        if (error.name === 'NotAllowedError') {
            showMessage('Permissão negada. Verifique as configurações do navegador.', 'error');
        }
    }
}

// Parar sistema de frequência
function stopFrequency() {
    isFrequencyActive = false;
    if (ndefReader) {
        ndefReader.removeEventListener("reading", handleNFCReading);
        ndefReader.removeEventListener("readingerror", handleNFCError);
    }
    updateFrequencyStatus();
    showMessage('Sistema parado', 'info');
}

// Processar leitura NFC
function handleNFCReading({ serialNumber }) {
    if (!isFrequencyActive) return;
    
    const students = getStudents();
    const presence = getTodaysPresence();
    
    // Verificar se o aluno já passou o cartão hoje
    if (presence[serialNumber]) {
        const student = students[serialNumber];
        const studentName = student ? student.name : 'Aluno desconhecido';
        showMessage(`Cartão já lido hoje: ${studentName}`, 'warning');
        return;
    }
    
    // Verificar se o cartão está cadastrado
    if (!students[serialNumber]) {
        // Cartão não cadastrado - abrir modal de cadastro
        currentSerial = serialNumber;
        openRegisterModal(serialNumber);
        return;
    }
    
    // Registrar presença
    const student = students[serialNumber];
    const now = new Date();
    const timeString = now.toLocaleTimeString('pt-BR');
    
    presence[serialNumber] = {
        name: student.name,
        time: timeString,
        timestamp: now.getTime()
    };
    
    saveTodaysPresence(presence);
    loadTodaysPresence();
    
    showMessage(`Presença registrada: ${student.name} às ${timeString}`, 'success');
}

// Tratar erros de leitura NFC
function handleNFCError() {
    showMessage('Erro ao ler cartão NFC', 'error');
}

// Abrir modal de cadastro
function openRegisterModal(serialNumber) {
    document.getElementById('modalSerial').textContent = serialNumber;
    document.getElementById('studentName').value = '';
    document.getElementById('registerModal').style.display = 'block';
    document.getElementById('studentName').focus();
}

// Fechar modal de cadastro
function closeModal() {
    document.getElementById('registerModal').style.display = 'none';
    currentSerial = null;
}

// Cadastrar novo aluno
function registerStudent() {
    const name = document.getElementById('studentName').value.trim();
    
    if (!name) {
        alert('Por favor, digite o nome do aluno');
        return;
    }
    
    if (!currentSerial) {
        alert('Erro: Serial do cartão não encontrado');
        return;
    }
    
    const students = getStudents();
    students[currentSerial] = {
        name: name,
        registeredAt: new Date().toISOString()
    };
    
    saveStudents(students);
    loadStudentsList();
    
    // Registrar presença automaticamente após cadastro
    const presence = getTodaysPresence();
    const now = new Date();
    const timeString = now.toLocaleTimeString('pt-BR');
    
    presence[currentSerial] = {
        name: name,
        time: timeString,
        timestamp: now.getTime()
    };
    
    saveTodaysPresence(presence);
    loadTodaysPresence();
    
    showMessage(`Aluno cadastrado e presença registrada: ${name} às ${timeString}`, 'success');
    closeModal();
}

// Carregar lista de alunos
function loadStudentsList() {
    const students = getStudents();
    const container = document.getElementById('studentsList');
    
    if (Object.keys(students).length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhum aluno cadastrado</p>';
        return;
    }
    
    let html = '<div class="students-grid">';
    
    Object.entries(students).forEach(([serial, student]) => {
        const registeredDate = new Date(student.registeredAt).toLocaleDateString('pt-BR');
        html += `
            <div class="student-card">
                <div class="student-name">${student.name}</div>
                <div class="student-serial">Serial: ${serial}</div>
                <div class="student-date">Cadastrado: ${registeredDate}</div>
                <button onclick="removeStudent('${serial}')" class="remove-btn">Remover</button>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Carregar presença do dia
function loadTodaysPresence() {
    const presence = getTodaysPresence();
    const container = document.getElementById('todaysPresence');
    
    if (Object.keys(presence).length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhuma presença registrada hoje</p>';
        return;
    }
    
    // Ordenar por horário
    const sortedPresence = Object.entries(presence).sort((a, b) => {
        return a[1].timestamp - b[1].timestamp;
    });
    
    let html = '<div class="presence-list-container">';
    
    sortedPresence.forEach(([serial, record]) => {
        html += `
            <div class="presence-item">
                <span class="presence-name">${record.name}</span>
                <span class="presence-time">${record.time}</span>
                <button onclick="removePresence('${serial}')" class="remove-btn small">X</button>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Remover aluno
function removeStudent(serial) {
    if (confirm('Tem certeza que deseja remover este aluno?')) {
        const students = getStudents();
        delete students[serial];
        saveStudents(students);
        loadStudentsList();
        showMessage('Aluno removido com sucesso', 'info');
    }
}

// Remover presença específica
function removePresence(serial) {
    if (confirm('Tem certeza que deseja remover esta presença?')) {
        const presence = getTodaysPresence();
        delete presence[serial];
        saveTodaysPresence(presence);
        loadTodaysPresence();
        showMessage('Presença removida', 'info');
    }
}

// Limpar presença do dia
function clearTodaysPresence() {
    if (confirm('Tem certeza que deseja limpar toda a presença de hoje?')) {
        saveTodaysPresence({});
        loadTodaysPresence();
        showMessage('Presença do dia limpa', 'info');
    }
}

// Atualizar status da frequência
function updateFrequencyStatus() {
    const statusDiv = document.getElementById('frequencyStatus');
    const startBtn = document.getElementById('startFrequencyButton');
    const stopBtn = document.getElementById('stopFrequencyButton');
    const nfcDisplay = document.getElementById('nfcDisplay');
    
    if (isFrequencyActive) {
        statusDiv.textContent = 'Sistema ativo - Aproxime os cartões NFC';
        statusDiv.className = 'status-display active';
        startBtn.disabled = true;
        stopBtn.disabled = false;
        nfcDisplay.textContent = 'Aguardando cartão NFC...';
        nfcDisplay.className = 'nfc-display active';
    } else {
        statusDiv.textContent = 'Sistema parado';
        statusDiv.className = 'status-display';
        startBtn.disabled = false;
        stopBtn.disabled = true;
        nfcDisplay.textContent = 'Aguardando início da frequência...';
        nfcDisplay.className = 'nfc-display';
    }
}

// Mostrar mensagens
function showMessage(message, type = 'info') {
    const nfcDisplay = document.getElementById('nfcDisplay');
    
    nfcDisplay.textContent = message;
    nfcDisplay.className = `nfc-display ${type}`;
    
    // Limpar mensagem após alguns segundos (exceto se sistema estiver ativo)
    if (type !== 'success' || !isFrequencyActive) {
        setTimeout(() => {
            if (isFrequencyActive) {
                nfcDisplay.textContent = 'Aguardando cartão NFC...';
                nfcDisplay.className = 'nfc-display active';
            }
        }, 3000);
    }
}

// Permitir cadastro com Enter
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('registerModal').style.display === 'block') {
        registerStudent();
    }
});

// Fechar modal clicando fora dele
document.getElementById('registerModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});