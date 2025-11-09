// --- LÓGICA DE PROTECCIÓN DE RUTA (MODIFICADA PARA SUPABASE) ---
const { createClient } = supabase;

// ¡¡REEMPLAZA ESTO con las MISMAS credenciales que usaste en script.js!!
const SUPABASE_URL = 'https://ynabhnzkbywanwlejafg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluYWJobnprYnl3YW53bGVqYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTA3MjUsImV4cCI6MjA3ODE4NjcyNX0.H-EFIAbB4zhaS6GQuUtl9UjCERp3lvsCopNFxDBDjfw';
let _supabase;
// --- FIN DE LÓGICA DE PROTECCIÓN ---


// --- Lógica del Menú de Navegación Móvil ---
const mobileMenuButton = document.getElementById('mobileMenuButton');
const mobileMenu = document.getElementById('mobile-menu');

if (mobileMenuButton) {
    const menuIcon = mobileMenuButton.querySelector('svg.block');
    const closeIcon = mobileMenuButton.querySelector('svg.hidden');

    mobileMenuButton.addEventListener('click', () => {
        const isExpanded = mobileMenuButton.getAttribute('aria-expanded') === 'true';
        mobileMenuButton.setAttribute('aria-expanded', !isExpanded);
        mobileMenu.classList.toggle('hidden');
        menuIcon.classList.toggle('hidden');
        closeIcon.classList.toggle('hidden');
    });
}

// --- Lógica de Logout (MODIFICADA PARA SUPABASE) ---
async function handleLogout() {
    if (!_supabase) return;
    
    const { error } = await _supabase.auth.signOut();
    if (error) {
        console.error('Error al cerrar sesión:', error.message);
    }
    // onAuthStateChange (abajo) detectará el evento 'SIGNED_OUT'
    // y se encargará de la redirección automáticamente.
}

// Asignar eventos a los botones de logout
const logoutButton = document.getElementById('logoutButton');
const logoutButtonMobile = document.getElementById('logoutButtonMobile');

if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
}
if (logoutButtonMobile) {
    logoutButtonMobile.addEventListener('click', handleLogout);
}
// --- FIN Lógica de Logout ---


/*
  Lógica específica de la página de historial.
  Carga y muestra el log de cambios desde Supabase.
*/

console.log("Lógica de Historial cargada.");

// --- Lógica para Cargar y Mostrar el Historial ---

// ELIMINADO: const HISTORY_KEY = 'sgi-change-history-local';
const historyTableBody = document.getElementById('historyTableBody');
const historyEmptyState = document.getElementById('historyEmptyState');

/**
 * Formatea una fecha ISO (YYYY-MM-DDTHH:MM:SS.sssZ) a un formato legible.
 * La fecha proviene de la columna 'created_at' de Supabase.
 * @param {string} isoString - La fecha en formato ISO.
 * @returns {string} - La fecha formateada (DD/MM/YYYY HH:MM:SS)
 */
function formatISODate(isoString) {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        // Formato local de Perú: DD/MM/YYYY, HH:MM:SS
        return date.toLocaleString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false // Usar formato 24h
        }).replace(',', ''); // Quitar la coma que a veces se intercala
    } catch (e) {
        return isoString; // Devuelve el original si falla
    }
}

/**
 * Carga el historial desde Supabase y lo renderiza en la tabla.
 */
async function loadChangeHistory() {
    if (!_supabase) {
        console.error("Supabase client no inicializado.");
        return;
    }

    console.log("Fetching change history from Supabase...");

    // Consultar la tabla 'historial'.
    // RLS filtra automáticamente por user_id.
    const { data: history, error } = await _supabase
        .from('historial')
        .select('*')
        .order('created_at', { ascending: false }); // Mostrar lo más reciente primero

    if (error) {
        console.error('Error al cargar historial desde Supabase:', error.message);
        return;
    }

    const historyData = history || [];

    if (!historyTableBody || !historyEmptyState) {
        console.error("No se encontraron los elementos de la tabla de historial.");
        return;
    }

    // Comprobar si hay historial
    if (historyData.length === 0) {
        historyEmptyState.classList.remove('hidden'); // Mostrar estado vacío
        // Usar el padre de historyTableBody, que es el div con overflow-x-auto, para ocultar
        const tableContainer = historyTableBody.closest('.overflow-x-auto');
        if (tableContainer) {
            tableContainer.classList.add('hidden'); // Ocultar <table>
        }
    } else {
        historyEmptyState.classList.add('hidden'); // Ocultar estado vacío
        const tableContainer = historyTableBody.closest('.overflow-x-auto');
        if (tableContainer) {
            tableContainer.classList.remove('hidden'); // Mostrar <table>
        }
        
        historyTableBody.innerHTML = ''; // Limpiar tabla
        
        // Llenar la tabla con las entradas del historial
        historyData.forEach(entry => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';

            // Estilos para el tipo de cambio
            let tipoClass = 'text-gray-700';
            let tipoText = entry.tipo || 'N/A';
            if (tipoText === 'Nuevo') {
                tipoClass = 'text-green-600 font-medium';
            } else if (tipoText === 'Edición') {
                tipoClass = 'text-blue-600 font-medium';
            } else if (tipoText === 'Eliminación') {
                tipoClass = 'text-red-600 font-medium';
            }

            // Sanitizar valores
            const userEmail = entry.user_email || 'N/A'; // Campo user_email añadido a la tabla
            const producto = entry.producto || 'N/A';
            const campo = entry.campo || 'N/A';
            // Nota: Usamos los nombres de columna de tu SQL: "valorAnterior" y "valorNuevo"
            const valorAnt = entry.valorAnterior !== null && entry.valorAnterior !== undefined ? entry.valorAnterior : 'N/A';
            const valorNue = entry.valorNuevo !== null && entry.valorNuevo !== undefined ? entry.valorNuevo : 'N/A';
            // La fecha viene de 'created_at'
            const fecha = formatISODate(entry.created_at); 

            // Renderizar la fila con el email primero
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${userEmail}</td> <!-- COLUMNA DE EMAIL -->
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${producto}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${tipoClass}">${tipoText}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${campo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${valorAnt}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${valorNue}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fecha}</td>
            `;
            historyTableBody.appendChild(row);
        });
    }
}

// --- INICIALIZACIÓN CON SUPABASE ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Validar e inicializar Supabase
    if (!SUPABASE_URL.startsWith('http') || !SUPABASE_ANON_KEY.startsWith('ey')) {
         console.error('Por favor, configura SUPABASE_URL y SUPABASE_ANON_KEY en historial.js');
         window.location.href = 'index.html';
         return;
    }
    try {
         _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
         console.error('Error inicializando Supabase en historial.js');
         window.location.href = 'index.html';
         return;
    }

    // 2. Poner el "guardia" de autenticación
    _supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'INITIAL_SESSION' && !session) || event === 'SIGNED_OUT') {
            // Lo botamos al login
            window.location.href = 'index.html';
        } else if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
            // Si hay sesión, cargamos el contenido de la página
            loadChangeHistory();
        }
    });
});