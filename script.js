/**
 * Lógica de la página de Login con Supabase
 */

// --- Configuración de Supabase ---
// ¡¡REEMPLAZA ESTO con tus credenciales de Supabase!!
// Las encuentras en tu proyecto de Supabase > Settings > API
const SUPABASE_URL = 'https://ynabhnzkbywanwlejafg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluYWJobnprYnl3YW53bGVqYWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTA3MjUsImV4cCI6MjA3ODE4NjcyNX0.H-EFIAbB4zhaS6GQuUtl9UjCERp3lvsCopNFxDBDjfw';
// --- Fin de Configuración ---

// Importar el cliente de Supabase desde el CDN
const { createClient } = supabase;
let _supabase;

// --- Selectores del DOM ---
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email'); // Actualizado de usernameInput
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const loginSpinner = document.getElementById('loginSpinner');
const loginButtonText = document.getElementById('loginButtonText');
const loginError = document.getElementById('loginError');
const loginErrorMessage = document.getElementById('loginErrorMessage');

/**
 * Muestra un mensaje de error en el formulario.
 * @param {string} message - El mensaje a mostrar.
 */
function showError(message) {
    // Mapear mensajes comunes de Supabase a español
    let friendlyMessage = message;
    if (message === 'Invalid login credentials') {
        friendlyMessage = 'Email o contraseña incorrectos.';
    } else if (message.includes('Failed to fetch')) {
        friendlyMessage = 'Error de red. No se pudo conectar a Supabase.';
    }

    loginErrorMessage.textContent = friendlyMessage;
    loginError.classList.remove('hidden');
}

/**
 * Oculta el mensaje de error.
 */
function hideError() {
    loginError.classList.add('hidden');
}

/**
 * Habilita el estado de "cargando" en el botón.
 */
function setLoading(isLoading) {
    if (isLoading) {
        loginButton.disabled = true;
        loginSpinner.classList.remove('hidden');
        loginButtonText.textContent = 'Verificando...';
    } else {
        loginButton.disabled = false;
        loginSpinner.classList.add('hidden');
        loginButtonText.textContent = 'Ingresar';
    }
}

/**
 * Maneja el envío del formulario de login con Supabase.
 */
async function handleLogin(e) {
    e.preventDefault();
    hideError();
    setLoading(true);

    const email = emailInput.value;
    const password = passwordInput.value;

    // --- AUTENTICACIÓN CON SUPABASE ---
    // Ya no simulamos, llamamos al backend real
    const { data, error } = await _supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        // --- FALLO ---
        console.error('Error de Supabase:', error.message);
        showError(error.message);
        setLoading(false);
    } else {
        // --- ÉXITO ---
        // Supabase maneja la sesión automáticamente.
        // Redirigimos al dashboard (inicio.html)
        window.location.href = 'inicio.html';
    }
}

/**
 * Verifica si el usuario ya tiene una sesión activa en Supabase.
 */
async function checkActiveSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (session) {
        // Si ya está logueado, redirigir al dashboard.
        window.location.href = 'inicio.html';
    }
    // Si no hay sesión, no hace nada y deja que se muestre el login.
}

/**
 * Función principal de inicialización.
 */
function initializeApp() {
    // Validar credenciales de Supabase
    if (!SUPABASE_URL.startsWith('http') || !SUPABASE_ANON_KEY.startsWith('ey')) {
        showError('Credenciales de Supabase no configuradas en script.js');
        console.error('Por favor, configura SUPABASE_URL y SUPABASE_ANON_KEY en script.js');
        return;
    }

    // Inicializar el cliente de Supabase
    try {
        _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
        console.error('Error inicializando Supabase:', error);
        showError('Error al inicializar el cliente de Supabase.');
        return;
    }


    // 1. Verificar si ya hay sesión al cargar la página
    checkActiveSession();

    // 2. Asignar el evento al formulario
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

// --- Flujo de Inicialización ---
document.addEventListener('DOMContentLoaded', initializeApp);