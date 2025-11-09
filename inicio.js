// --- Importación y Configuración del Cliente Supabase ---
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ¡IMPORTANTE! Reemplaza estas variables con las claves de tu proyecto Supabase.
// La URL y la clave ANON_PUBLIC son necesarias para interactuar con la base de datos.
const SUPABASE_URL = 'https://ynabhnzkbywanwlejafg.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluYWJobnprYnl3YW53bGVqYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTA3MjUsImV4cCI6MjA3ODE4NjcyNX0.H-EFIAbB4zhaS6GQuUtl9UjCERp3lvsCopNFxDBDjfw'; 

// Inicializa el cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUserId = 'Cargando...';

// --- LÓGICA DE PROTECCIÓN DE RUTA (Supabase) ---
/**
 * Verifica el estado de la sesión del usuario.
 * Si no está autenticado, redirige al login.
 * También inicia la escucha de datos si tiene éxito.
 */
async function protectRouteAndInitData() {
    // 1. Obtener la sesión actual.
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
        console.error('Error al obtener la sesión:', error.message);
    }
    
    // 2. Si no hay sesión válida, redirigir.
    if (!user) {
        console.log("No hay sesión activa. Redirigiendo a index.html.");
        // Redirigir al login
        window.location.href = 'index.html';
        return;
    }

    // 3. Sesión activa: Mostrar ID y cargar datos.
    currentUserId = user.id;
    const userIdDisplayEl = document.getElementById('userIdDisplay');
    if (userIdDisplayEl) {
        userIdDisplayEl.textContent = currentUserId;
    }
    console.log("Usuario autenticado. UID:", currentUserId);
    
    // Iniciar la carga de datos del resumen
    loadInventorySummary();
}
// --- FIN DE LÓGICA DE PROTECCIÓN ---


// --- Lógica del Menú de Navegación Móvil (Se mantiene igual) ---
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

// --- Lógica de Logout (Supabase) ---
async function handleLogout() {
    // 1. Cerrar la sesión en Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
        console.error('Error al cerrar la sesión:', error.message);
        // En una app real se mostraría un modal, no un alert().
        return; 
    }
    
    // 2. Redirigir al login (asumo que index.html es la página de login)
    window.location.href = 'index.html';
}

// Asignar eventos a los botones de logout (DOM Ready es mejor para asegurarse de que existan)
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    const logoutButtonMobile = document.getElementById('logoutButtonMobile');

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    if (logoutButtonMobile) {
        logoutButtonMobile.addEventListener('click', handleLogout);
    }
});


// --- Lógica de la Página de Inicio (Resumen con Supabase) ---

// Selectores de Tarjetas de Resumen
const totalSkusEl = document.getElementById('totalSkus');
const totalStockEl = document.getElementById('totalStock');
const stockAlertsEl = document.getElementById('stockAlerts');

/**
 * Carga el inventario desde Supabase.
 */
async function loadInventorySummary() {
    try {
        // La RLS de Supabase (configurada en tu primer mensaje) asegura que solo se traigan
        // los datos donde user_id coincida con el auth.uid() del usuario logueado.
        const { data, error } = await supabase
            .from('inventario')
            .select('stockActual, stockMinimo'); // Solo necesitamos estos dos campos para el resumen

        if (error) {
            throw new Error(`Error al cargar el inventario: ${error.message}`);
        }

        updateSummaryCards(data || []);
    } catch (error) {
        console.error(error);
        // Mostrar error en las tarjetas
        if (totalSkusEl) totalSkusEl.textContent = 'Error';
        if (totalStockEl) totalStockEl.textContent = 'Error';
        if (stockAlertsEl) stockAlertsEl.textContent = 'Error';
    }
}

/**
 * Actualiza las tarjetas de resumen (Total SKUs, Total Stock, Alertas)
 * @param {Array} inventoryData - El array de inventario sobre el cual calcular.
 */
function updateSummaryCards(inventoryData) {
    if (!totalSkusEl || !totalStockEl || !stockAlertsEl) {
        return;
    }

    let articulosTotales = inventoryData.length;
    let stockTotalUnidades = 0;
    let alertasDeStock = 0;

    inventoryData.forEach(item => {
        // Supabase devuelve los campos 'numeric' como strings, así que usamos parseFloat
        const stockActual = parseFloat(item.stockActual || 0);
        const stockMinimo = parseFloat(item.stockMinimo || 0);
        
        stockTotalUnidades += stockActual;
        
        // Contar alertas: Si el stock mínimo es > 0 Y el stock actual es <= al mínimo.
        if (stockMinimo > 0 && stockActual <= stockMinimo) {
            alertasDeStock++;
        }
    });

    totalSkusEl.textContent = articulosTotales.toLocaleString('es-PE');
    // Formatear el stock total para mejor legibilidad
    totalStockEl.textContent = stockTotalUnidades.toLocaleString('es-PE', { maximumFractionDigits: 0 });
    stockAlertsEl.textContent = alertasDeStock.toLocaleString('es-PE');
}

// --- Flujo de Inicialización ---
document.addEventListener('DOMContentLoaded', protectRouteAndInitData);