// --- LÓGICA DE PROTECCIÓN DE RUTA (MODIFICADA PARA SUPABASE) ---
const { createClient } = supabase;

// ¡¡REEMPLAZA ESTO con las MISMAS credenciales que usaste en script.js!!
const SUPABASE_URL = 'https://ynabhnzkbywanwlejafg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluYWJobnprYnl3YW53bGVqYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTA3MjUsImV4cCI6MjA3ODE4NjcyNX0.H-EFIAbB4zhaS6GQuUtl9UjCERp3lvsCopNFxDBDjfw';
let _supabase;
let currentUser = null; // Guardará el usuario autenticado
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


// --- Estado de la App (Global) ---
let inventory = []; // La fuente de verdad ahora es Supabase
let currentEditingId = null;
let currentDeletingId = null;
// --- YA NO SE USAN LAS CLAVES DE LOCALSTORAGE ---
// const STORAGE_KEY = 'sgi-inventory-local';
// const HISTORY_KEY = 'sgi-change-history-local'; 

// --- Estado de Paginación ---
let currentPage = 1;
const itemsPerPage = 8; 
let currentFilteredInventory = []; 

// --- Selectores de Elementos ---
const modal = document.getElementById('itemModal');
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const form = document.getElementById('itemForm');
const inventoryList = document.getElementById('inventoryList'); 
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const dashboardContent = document.getElementById('dashboardContent');
const modalTitle = document.getElementById('modalTitle');
const deleteModal = document.getElementById('deleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const saveBtn = document.getElementById('saveBtn');
const formError = document.getElementById('formError'); 
const formErrorMessage = document.getElementById('formErrorMessage'); 

// Selectores de Tarjetas de Resumen
const totalSkusEl = document.getElementById('totalSkus');
const totalStockEl = document.getElementById('totalStock');
const stockAlertsEl = document.getElementById('stockAlerts');

// Selectores de Búsqueda y Filtro
const searchInput = document.getElementById('searchInput');
const filterToggleBtn = document.getElementById('filterToggleBtn');
const filterMenu = document.getElementById('filterMenu');
const filterCategoria = document.getElementById('filterCategoria');
const filterClase = document.getElementById('filterClase');
const filterEstado = document.getElementById('filterEstado');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

// --- Selectores (Paginación y Exportación) ---
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const paginationContainer = document.getElementById('paginationContainer');
const paginationInfo = document.getElementById('paginationInfo');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');


// --- Funciones de Carga de Supabase ---

/**
 * Carga el inventario desde Supabase
 */
async function loadInventoryFromSupabase() {
    if (!_supabase) return;

    // Mostrar estado de carga
    loadingState.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    
    // Asumimos que la tabla se llama 'inventario'
    // y ordenamos por 'created_at' para ver los más nuevos primero
    const { data, error } = await _supabase
        .from('inventario')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error cargando inventario:', error.message);
        // Mostrar error en la UI (opcional)
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.querySelector('h3').textContent = "Error al cargar datos";
        emptyState.querySelector('p').textContent = "No se pudo conectar con la base de datos. Intenta recargar.";
        return;
    }

    inventory = data || [];
    
    // Ocultar carga
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    
    // Volver a renderizar todo
    populateCategoryFilter();
    renderInventory();
}

// --- FIN Funciones de Almacenamiento ---

// --- NUEVA FUNCIÓN: Lógica de Historial (SUPABASE) ---

/**
 * Registra un cambio en la tabla 'historial' de Supabase.
 * @param {string} producto - Nombre del producto (SKU)
 * @param {string} tipo - 'Nuevo', 'Edición', 'Eliminación'
 * @param {string} campo - 'Stock Actual', 'Categoría', 'N/A', etc.
 * @param {string|number} valorAnterior - Valor antes del cambio
 * @param {string|number} valorNuevo - Valor después del cambio
 */
async function logChange(producto, tipo, campo, valorAnterior, valorNuevo) {
    if (!_supabase || !currentUser) {
        console.error("No se puede registrar el historial: Supabase o usuario no inicializado.");
        return;
    }

    const newEntry = {
        producto: producto,
        tipo: tipo,
        campo: campo,
        valorAnterior: valorAnterior !== undefined ? String(valorAnterior) : 'N/A',
        valorNuevo: valorNuevo !== undefined ? String(valorNuevo) : 'N/A',
        user_id: currentUser.id, // Asociar con el usuario
        // 'fechaHora' (o 'created_at') será manejado por Supabase
    };

    // Asumimos que la tabla se llama 'historial'
    const { error } = await _supabase.from('historial').insert(newEntry);

    if (error) {
        console.error("No se pudo guardar el historial de cambios en Supabase:", error.message);
    }
}


// --- Lógica de Renderizado y Filtro (Sin cambios, pero ahora usa 'inventory' global) ---

/**
 * Llena el selector de categorías basado en el inventario actual.
 */
function populateCategoryFilter() {
    const categorias = [...new Set(inventory.map(item => item.categoria).filter(Boolean))];
    categorias.sort();
    
    const currentValue = filterCategoria.value;
    
    filterCategoria.innerHTML = '<option value="all">Todas</option>'; 
    
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        filterCategoria.appendChild(option);
    });

    filterCategoria.value = currentValue;
}

/**
 * Renderiza el inventario en la tabla, aplicando filtros Y paginación.
 */
function renderInventory() {
    inventoryList.innerHTML = ''; 
    
    // Ocultar carga (esto se maneja en loadInventoryFromSupabase, pero por si acaso)
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');

    // --- 1. Aplicar Filtros ---
    const searchTerm = searchInput.value.toLowerCase();
    const categoria = filterCategoria.value;
    const clase = filterClase.value;
    const estado = filterEstado.value;

    currentFilteredInventory = inventory.filter(item => {
        const stockMinimo = item.stockMinimo || 0;
        const itemEstado = (stockMinimo > 0 && item.stockActual <= stockMinimo) ? 'low' : 'ok';
        
        const matchSearch = item.nombre.toLowerCase().includes(searchTerm);
        const matchCategoria = categoria === 'all' || item.categoria === categoria;
        const matchClase = clase === 'all' || item.claseABC === clase;
        const matchEstado = estado === 'all' || itemEstado === estado;

        return matchSearch && matchCategoria && matchClase && matchEstado;
    });

    // --- 2. Lógica de Paginación ---
    const totalItems = currentFilteredInventory.length;
    let totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages === 0) totalPages = 1;

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToRender = currentFilteredInventory.slice(startIndex, endIndex);

    // --- 3. Renderizar Paginación ---
    renderPagination(totalItems, totalPages);
    
    // --- 4. Renderizar Filas de la Tabla ---
    if (itemsToRender.length === 0) {
        paginationContainer.classList.add('hidden');
        if (inventory.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('h3').textContent = "No hay productos en el inventario";
            emptyState.querySelector('p').textContent = "Comienza agregando un nuevo producto para verlo aquí.";
        } else {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('h3').textContent = "No se encontraron productos";
            emptyState.querySelector('p').textContent = "Intenta ajustar tu búsqueda o filtros.";
        }
    } else {
        emptyState.classList.add('hidden');
        paginationContainer.classList.remove('hidden');
    }
    
    // (El orden 'created_at' de Supabase ya pone los nuevos primero)
    // itemsToRender.sort((a, b) => a.claseABC.localeCompare(b.claseABC));

    itemsToRender.forEach(item => {
        const stockMinimo = item.stockMinimo || 0;

        let abcClass = '';
        if (item.claseABC === 'A') abcClass = 'bg-red-100 text-red-800';
        if (item.claseABC === 'B') abcClass = 'bg-yellow-100 text-yellow-800';
        if (item.claseABC === 'C') abcClass = 'bg-blue-100 text-blue-800';

        let statusClass = 'bg-green-100 text-green-800';
        let statusText = 'En Stock';
        if (stockMinimo > 0 && item.stockActual <= stockMinimo) {
            statusClass = 'bg-red-100 text-red-800';
            statusText = 'Stock Bajo';
        }

        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        // *** IMPORTANTE: Usamos item.id de Supabase (que es un UUID) ***
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${item.nombre}</div>
                <div class="text-sm text-gray-500">${item.categoria || 'Sin categoría'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${abcClass}">${item.claseABC}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-center">${item.stockActual.toLocaleString('es-PE')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">${stockMinimo.toLocaleString('es-PE')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <button data-id="${item.id}" class="text-blue-600 hover:text-blue-900 mr-3 edit-btn">Editar</button>
                <button data-id="${item.id}" class="text-red-600 hover:text-red-900 delete-btn">Eliminar</button>
            </td>
        `;
        inventoryList.appendChild(row);
    });

    // 5. Actualizar Resumen
    updateSummaryCards(inventory);
}

/**
 * Actualiza las tarjetas de resumen (Total SKUs, Total Stock, Alertas)
 */
function updateSummaryCards(inventoryData) {
    let articulosTotales = inventoryData.length;
    let stockTotalUnidades = 0;
    let alertasDeStock = 0;

    inventoryData.forEach(item => {
        stockTotalUnidades += item.stockActual;
        const stockMinimo = item.stockMinimo || 0;
        if (stockMinimo > 0 && item.stockActual <= stockMinimo) {
            alertasDeStock++;
        }
    });

    totalSkusEl.textContent = articulosTotales;
    totalStockEl.textContent = stockTotalUnidades.toLocaleString('es-PE');
    stockAlertsEl.textContent = alertasDeStock;
}

/**
 * Renderiza los controles de paginación
 */
function renderPagination(totalItems, totalPages) {
    if (totalItems === 0) {
        paginationInfo.textContent = 'Mostrando 0 de 0 productos';
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        return;
    }

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    paginationInfo.textContent = `Mostrando ${startItem} - ${endItem} de ${totalItems} productos`;

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
}

// --- Funciones de Modal (Sin cambios) ---

function showModal(isEdit = false) {
    modalTitle.textContent = isEdit ? 'Editar Producto' : 'Agregar Nuevo Producto';
    modal.classList.remove('hidden');
    void modal.offsetWidth; 
    modal.querySelector('.modal-backdrop').classList.add('opacity-100');
    modal.querySelector('.modal-panel').classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
}

function hideModal() {
    modal.querySelector('.modal-backdrop').classList.remove('opacity-100');
    modal.querySelector('.modal-panel').classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
    setTimeout(() => {
        modal.classList.add('hidden');
        formError.classList.add('hidden'); 
        form.reset();
        currentEditingId = null;
    }, 300);
}

function showDeleteModal() {
    deleteModal.classList.remove('hidden');
    void deleteModal.offsetWidth;
    deleteModal.querySelector('.modal-backdrop').classList.add('opacity-100');
    deleteModal.querySelector('.modal-panel').classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
}

function hideDeleteModal() {
    deleteModal.querySelector('.modal-backdrop').classList.remove('opacity-100');
    deleteModal.querySelector('.modal-panel').classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
    setTimeout(() => {
        deleteModal.classList.add('hidden');
        currentDeletingId = null;
    }, 300);
}

// --- Event Listeners (Formulario y Modales) ---

openModalBtn.addEventListener('click', () => {
    currentEditingId = null;
    form.reset();
    document.getElementById('claseABC').value = 'C';
    document.getElementById('stockMinimo').value = ''; 
    showModal(false);
});
closeModalBtn.addEventListener('click', hideModal);
modal.querySelector('#modalBackdrop').addEventListener('click', hideModal);
cancelDeleteBtn.addEventListener('click', hideDeleteModal);
deleteModal.querySelector('.modal-backdrop').addEventListener('click', hideDeleteModal);

// --- Manejador de Submit (MODIFICADO PARA SUPABASE) ---

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        alert("Error: Usuario no autenticado.");
        return;
    }

    formError.classList.add('hidden'); 
    saveBtn.disabled = true; // Deshabilitar botón
    saveBtn.textContent = "Guardando...";

    // 1. Recopilar datos del formulario
    const itemData = {
        // No incluimos 'id' aquí, Supabase lo genera (o usamos currentEditingId para 'update')
        nombre: document.getElementById('nombre').value.trim(),
        categoria: document.getElementById('categoria').value.trim(),
        claseABC: document.getElementById('claseABC').value,
        stockActual: parseFloat(document.getElementById('stockActual').value) || 0,
        stockMinimo: parseFloat(document.getElementById('stockMinimo').value) || 0,
        user_id: currentUser.id // Siempre incluir el user_id
    };
    
    // 2. Validación básica
    if (!itemData.nombre) {
        formErrorMessage.textContent = "El nombre del producto no puede estar vacío.";
        formError.classList.remove('hidden');
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar";
        return;
    }

    // 3. Validación de Duplicados (ahora consulta Supabase)
    const nombreNormalizado = itemData.nombre.trim().toLowerCase();
    
    // Construir la consulta de duplicados
    let duplicateCheck = _supabase
        .from('inventario')
        .select('id')
        .eq('nombre', itemData.nombre.trim()); // Supabase puede ser sensible a mayúsculas, usar .trim()
        // NOTA: Una mejor validación usaría .ilike() o una función de BDD,
        // pero para este refactor, .eq() es suficiente si los datos son consistentes.
        
    if (currentEditingId) {
        // Si editamos, buscar si OTRO item tiene el mismo nombre
        duplicateCheck = duplicateCheck.neq('id', currentEditingId);
    }
    
    const { data: duplicates, error: duplicateError } = await duplicateCheck;
    
    if (duplicateError) {
        formErrorMessage.textContent = "Error al validar duplicados: " + duplicateError.message;
        formError.classList.remove('hidden');
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar";
        return;
    }

    if (duplicates && duplicates.length > 0) {
        formErrorMessage.textContent = `Ya existe un producto con el nombre "${itemData.nombre}". No se permiten duplicados.`;
        formError.classList.remove('hidden');
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar";
        return;
    }

    // 4. Ejecutar Operación (Crear o Actualizar)
    let dbError = null;

    if (currentEditingId) {
        // --- Actualizar (UPDATE) ---
        const oldItem = inventory.find(item => item.id === currentEditingId);
        
        // El 'user_id' no debe cambiar, así que lo quitamos del objeto de actualización
        // (La política de RLS debe permitir 'update' si user_id coincide)
        const { user_id, ...updateData } = itemData; 
        
        const { error } = await _supabase
            .from('inventario')
            .update(updateData)
            .eq('id', currentEditingId);
        
        dbError = error;

        // Registrar historial si la actualización fue exitosa
        if (!error && oldItem) {
            if (oldItem.nombre !== updateData.nombre) { await logChange(updateData.nombre, 'Edición', 'Nombre', oldItem.nombre, updateData.nombre); }
            if (oldItem.categoria !== updateData.categoria) { await logChange(updateData.nombre, 'Edición', 'Categoría', oldItem.categoria, updateData.categoria); }
            if (oldItem.claseABC !== updateData.claseABC) { await logChange(updateData.nombre, 'Edición', 'Clase ABC', oldItem.claseABC, updateData.claseABC); }
            if (oldItem.stockActual !== updateData.stockActual) { await logChange(updateData.nombre, 'Edición', 'Stock Actual', oldItem.stockActual, updateData.stockActual); }
            if (oldItem.stockMinimo !== updateData.stockMinimo) { await logChange(updateData.nombre, 'Edición', 'Stock Mínimo', oldItem.stockMinimo, updateData.stockMinimo); }
        }

    } else {
        // --- Crear (INSERT) ---
        // 'itemData' ya incluye el 'user_id'
        const { error } = await _supabase
            .from('inventario')
            .insert(itemData);
            
        dbError = error;
        
        // Registrar historial si la inserción fue exitosa
        if (!error) {
            await logChange(itemData.nombre, 'Nuevo', 'N/A', '', '');
        }
    }
    
    // 5. Manejar resultado
    saveBtn.disabled = false;
    saveBtn.textContent = "Guardar";

    if (dbError) {
        formErrorMessage.textContent = "Error al guardar en Supabase: " + dbError.message;
        formError.classList.remove('hidden');
    } else {
        // Éxito: recargar inventario y cerrar modal
        await loadInventoryFromSupabase(); // Recargar la lista desde la BDD
        hideModal();
    }
});

// --- Manejador de Clicks en la Tabla (MODIFICADO) ---

inventoryList.addEventListener('click', (e) => {
    const target = e.target;
    const id = target.dataset.id; // Este ID ahora es el UUID de Supabase
    if (!id) return;

    // Botón Editar
    if (target.classList.contains('edit-btn')) {
        const item = inventory.find(item => item.id === id); // Buscar en el array global
        if (item) {
            currentEditingId = id;
            
            // Llenar formulario (el itemId no es un input visible, pero es útil)
            document.getElementById('itemId').value = item.id; 
            document.getElementById('nombre').value = item.nombre;
            document.getElementById('categoria').value = item.categoria;
            document.getElementById('claseABC').value = item.claseABC;
            document.getElementById('stockActual').value = item.stockActual;
            document.getElementById('stockMinimo').value = item.stockMinimo || 0;
            
            showModal(true);
        }
    }

    // Botón Eliminar
    if (target.classList.contains('delete-btn')) {
        currentDeletingId = id;
        showDeleteModal();
    }
});

// --- Manejador de Confirmar Eliminación (MODIFICADO PARA SUPABASE) ---

confirmDeleteBtn.addEventListener('click', async () => {
    if (currentDeletingId) {
        
        // 1. (Opcional) Encontrar el item ANTES de borrarlo para registrar el nombre
        const itemToDelete = inventory.find(item => item.id === currentDeletingId);
        const nombreProducto = itemToDelete ? itemToDelete.nombre : 'Producto Desconocido';

        // 2. Ejecutar borrado en Supabase
        const { error } = await _supabase
            .from('inventario')
            .delete()
            .eq('id', currentDeletingId);

        if (error) {
            console.error("Error al eliminar:", error.message);
            // (Opcional) Mostrar error al usuario en el modal
            alert("Error al eliminar el producto: " + error.message);
        } else {
            // 3. Registrar en historial (solo si se borró bien)
            if (itemToDelete) {
                await logChange(nombreProducto, 'Eliminación', 'N/A', '', '');
            }
            
            // 4. Recargar el inventario desde la BDD
            await loadInventoryFromSupabase();
            hideDeleteModal();
        }
    }
});

// --- Event Listeners (Búsqueda y Filtros) (Sin cambios) ---

searchInput.addEventListener('input', () => {
    currentPage = 1; 
    renderInventory();
});

filterToggleBtn.addEventListener('click', () => {
    filterMenu.classList.toggle('hidden');
});

applyFiltersBtn.addEventListener('click', () => {
    currentPage = 1; 
    renderInventory();
    filterMenu.classList.add('hidden');
});

resetFiltersBtn.addEventListener('click', () => {
    filterCategoria.value = 'all';
    filterClase.value = 'all';
    filterEstado.value = 'all';
    currentPage = 1; 
    renderInventory();
});


// --- Event Listeners (Paginación) (Sin cambios) ---

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderInventory();
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(currentFilteredInventory.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderInventory();
    }
});

// --- Funciones y Listeners (Exportación) (Sin cambios) ---

function getFormattedDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}


// --- PDF ---
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("Reporte de Inventario - Impresos S.R.L.", 20, 10);

    const tableHead = [["Producto", "Categoría", "Clase ABC", "Stock Actual", "Stock Mínimo", "Estado"]];
    
    // Usar 'currentFilteredInventory' (los datos que el usuario está viendo)
    const tableBody = currentFilteredInventory.map(item => {
        const stockMinimo = item.stockMinimo || 0;
        const estado = (stockMinimo > 0 && item.stockActual <= stockMinimo) ? 'Stock Bajo' : 'En Stock';
        return [
            item.nombre,
            item.categoria || 'Sin categoría',
            item.claseABC,
            item.stockActual,
            stockMinimo,
            estado
        ];
    });

    doc.autoTable({
        head: tableHead,
        body: tableBody,
        startY: 20,
    });

    const fileName = `Inventario_${getFormattedDateTime()}.pdf`;
    doc.save(fileName);
}

// --- EXCEL ---
function exportToExcel() {
    // Usar 'currentFilteredInventory' (los datos que el usuario está viendo)
    const dataToExport = currentFilteredInventory.map(item => {
        const stockMinimo = item.stockMinimo || 0;
        const estado = (stockMinimo > 0 && item.stockActual <= stockMinimo) ? 'Stock Bajo' : 'En Stock';
        return {
            'Producto (SKU)': item.nombre,
            'Categoría': item.categoria || 'Sin categoría',
            'Clase ABC': item.claseABC,
            'Stock Actual': item.stockActual,
            'Stock Mínimo': stockMinimo,
            'Estado': estado
        };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");

    const fileName = `Inventario_${getFormattedDateTime()}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

exportPdfBtn.addEventListener('click', exportToPDF);
exportExcelBtn.addEventListener('click', exportToExcel);



// --- Flujo de Inicialización (MODIFICADO) ---
async function initializeAppLogic() {
    // Esta función ahora es asíncrona
    // Primero, obtenemos el usuario actual
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        currentUser = user;
    } else {
        // Si por alguna razón no hay usuario (aunque onAuthStateChange lo protege),
        // no continuamos.
        console.error("No hay usuario autenticado. Redirigiendo al login.");
        window.location.href = 'index.html';
        return;
    }

    // Ahora que tenemos usuario, cargamos el inventario
    await loadInventoryFromSupabase();
    // (populateCategoryFilter y renderInventory son llamados dentro de loadInventoryFromSupabase)
}

// --- INICIALIZACIÓN CON SUPABASE (MODIFICADO) ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Validar e inicializar Supabase
    if (!SUPABASE_URL.startsWith('http') || !SUPABASE_ANON_KEY.startsWith('ey')) {
         console.error('Por favor, configura SUPABASE_URL y SUPABASE_ANON_KEY en inventarios.js');
         // (Opcional) Mostrar un error en la página
         document.body.innerHTML = '<h1>Error de Configuración</h1><p>Contacte al administrador.</p>';
         return;
    }
    try {
         _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
         console.error('Error inicializando Supabase en inventarios.js');
         document.body.innerHTML = '<h1>Error de Inicialización</h1><p>Contacte al administrador.</p>';
         return;
    }

    // 2. Poner el "guardia" de autenticación
    _supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'INITIAL_SESSION' && !session) || event === 'SIGNED_OUT') {
            // Lo botamos al login
            window.location.href = 'index.html';
        } else if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
            // Si hay sesión, cargamos el contenido de la página
            // La función initializeAppLogic ahora obtendrá el usuario
            // y luego cargará los datos.
            initializeAppLogic();
        }
    });
});