/**
 * src/utils/eventBus.js
 * Sistem Pub/Sub sederhana untuk komunikasi antar modul tanpa Circular Dependency.
 */

class EventBus {
    constructor() {
        this.events = {};
    }

    // Mendaftarkan pendengar (listener)
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }

    // Menghapus pendengar
    off(eventName, callback) {
        if (!this.events[eventName]) return;
        this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    }

    // Memancarkan event beserta data (trigger)
    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => callback(data));
        }
    }
}

// Ekspor instance tunggal (Singleton) agar digunakan oleh seluruh aplikasi
export const appEventBus = new EventBus();
