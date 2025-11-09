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
  Lógica específica de la página de reportes.
  Carga datos del localStorage y genera los reportes.
*/

console.log("Lógica de Reportes cargada.");

// ELIMINADO: const STORAGE_KEY = 'sgi-inventory-local';
// Ya no se usa localStorage, ahora se lee de Supabase.

/**
 * Carga los datos del inventario desde SUPABASE.
 */
async function loadInventoryData() {
    // 1. Verificar que Supabase esté inicializado
    if (!_supabase) {
        console.error("Supabase client not initialized.");
        return;
    }

    console.log("Fetching inventory data from Supabase...");
    
    // 2. Hacer la consulta a la tabla 'inventario'
    // RLS (Row Level Security) se encarga automáticamente
    // de filtrar solo los productos del usuario autenticado.
    // Usamos select('*') para obtener todas las columnas que definiste
    // (nombre, "stockActual", "stockMinimo", etc.)
    const { data: inventory, error } = await _supabase
        .from('inventario')
        .select('*');

    // 3. Manejar errores de la consulta
    if (error) {
        console.error('Error al cargar datos del inventario desde Supabase:', error.message);
        // Aquí podrías mostrar un mensaje de error en la UI si quisieras
        return;
    }

    // 4. Si la consulta fue exitosa, inventory contendrá los datos
    const inventoryData = inventory || [];
    console.log("Datos de inventario cargados desde Supabase:", inventoryData);
    
    // 5. Llamar a las funciones que generan los reportes
    // (Estas funciones no necesitan cambiar, ya que reciben el array)
    generateReposicionReport(inventoryData);
    generateAtencionReport(inventoryData);
}

/**
 * Genera el reporte de productos que necesitan reposición (Stock <= Mínimo).
 * @param {Array} inventory - El inventario completo (de Supabase).
 */
function generateReposicionReport(inventory) {
    const tableBody = document.getElementById('reporteReposicionList');
    const emptyEl = document.getElementById('reporteReposicionEmpty');
    
    if (!tableBody || !emptyEl) return;

    // Filtrar productos que necesitan compra (Actual <= Mínimo)
    // Se incluyen solo si el mínimo es mayor que 0
    const itemsToBuy = inventory.filter(item => {
        // Usamos los nombres de columna de tu SQL: "stockMinimo" y "stockActual"
        const min = item.stockMinimo || 0;
        return min > 0 && item.stockActual <= min;
    });

    // Ordenar por el más necesitado (mayor cantidad a comprar)
    itemsToBuy.sort((a, b) => {
        const aNeeded = (a.stockMinimo || 0) - a.stockActual;
        const bNeeded = (b.stockMinimo || 0) - b.stockActual;
        return bNeeded - aNeeded;
    });

    tableBody.innerHTML = ''; // Limpiar tabla

    if (itemsToBuy.length === 0) {
        emptyEl.classList.remove('hidden');
        tableBody.parentElement.classList.add('hidden'); // Ocultar la tabla
    } else {
        emptyEl.classList.add('hidden');
        tableBody.parentElement.classList.remove('hidden'); // Mostrar la tabla
        
        itemsToBuy.forEach(item => {
            const cantidadAComprar = (item.stockMinimo || 0) - item.stockActual;
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-4 py-3 text-sm font-medium text-gray-900">${item.nombre}</td>
                <td class="px-4 py-3 text-sm text-red-600 font-bold">${item.stockActual.toLocaleString('es-PE')}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${(item.stockMinimo || 0).toLocaleString('es-PE')}</td>
                <td class="px-4 py-3 text-sm text-blue-600 font-bold">${cantidadAComprar.toLocaleString('es-PE')}</td>
            `;
            tableBody.appendChild(tr);
        });
    }
}

/**
 * Genera el reporte de productos en "Atención" (estado intermedio).
 * @param {Array} inventory - El inventario completo (de Supabase).
 */
function generateAtencionReport(inventory) {
    const tableBody = document.getElementById('reporteAtencionList');
    const emptyEl = document.getElementById('reporteAtencionEmpty');

    if (!tableBody || !emptyEl) return;

    // Umbral de advertencia: 150% del stock mínimo.
    const warningThreshold = 1.5; // 150%
    
    const itemsInWarning = inventory.filter(item => {
        const min = item.stockMinimo || 0;
        
        // --- LÓGICA DE FILTRADO (sin cambios) ---
        const minThreshold = min + 1; // Mínimo: Stock Mínimo + 1
        const maxThreshold = min * warningThreshold; // Máximo: 150% del Mínimo

        return min > 0 && 
               item.stockActual >= minThreshold && 
               item.stockActual <= maxThreshold;
    });

    // Ordenar por el más cercano al mínimo (porcentaje más bajo)
    itemsInWarning.sort((a, b) => {
        const aPerc = a.stockActual / (a.stockMinimo || 1);
        const bPerc = b.stockActual / (b.stockMinimo || 1);
        return aPerc - bPerc;
    });

    tableBody.innerHTML = ''; // Limpiar tabla

    if (itemsInWarning.length === 0) {
        emptyEl.classList.remove('hidden');
        tableBody.parentElement.classList.add('hidden'); // Ocultar la tabla
    } else {
        emptyEl.classList.add('hidden');
        tableBody.parentElement.classList.remove('hidden'); // Mostrar la tabla
        
        itemsInWarning.forEach(item => {
            
            const min = item.stockMinimo || 0;
            const actual = item.stockActual;

            // --- CÁLCULO ACTUALIZADO A LA FÓRMULA DE LA IMAGEN: (Actual - Mínimo) / Mínimo * 100 ---
            // Esta fórmula calcula el margen porcentual que tenemos SOBRE el stock mínimo.
            
            let porcentajeRestanteNum = 0;
            if (min > 0) {
                 porcentajeRestanteNum = ((actual - min) / min) * 100;
            }

            // Formatear a 2 decimales
            const porcentajeRestante = porcentajeRestanteNum.toFixed(2);

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            
            tr.innerHTML = `
                <td class="px-4 py-3 text-sm font-medium text-gray-900">${item.nombre}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${item.stockActual.toLocaleString('es-PE')}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${(item.stockMinimo || 0).toLocaleString('es-PE')}</td>
                <td class="px-4 py-3 text-sm text-yellow-700 font-bold">${porcentajeRestante}%</td>
                <td class="px-4 py-3 text-sm text-yellow-700">🟡 Atención</td>
            `;
            tableBody.appendChild(tr);
        });
    }
}

// --- INICIALIZACIÓN CON SUPABASE ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Validar e inicializar Supabase
    if (!SUPABASE_URL.startsWith('http') || !SUPABASE_ANON_KEY.startsWith('ey')) {
         console.error('Por favor, configura SUPABASE_URL y SUPABASE_ANON_KEY en reportes.js');
         window.location.href = 'index.html';
         return;
    }
    try {
         _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
         console.error('Error inicializando Supabase en reportes.js');
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
            // ¡ESTA ES LA LÍNEA MÁS IMPORTANTE!
            // Llama a la nueva función asíncrona que carga desde Supabase.
            loadInventoryData();
        }
    });
});