/**
 * src/state/gamification.js
 * Mengatur sistem XP, Level, Rank, dan verifikasi manual.
 * Data disimpan di localStorage agar persisten (tidak hilang saat di-refresh).
 */

// Kita asumsikan fungsi showToast akan ada di file modals.js nantinya
import { showToast } from '../ui/modals.js';

export const GameSystem = {
    stats: { xp: 0, level: 1, verifiedCount: 0 },
    verifiedPids: [],

    init: function() {
        const storedStats = localStorage.getItem('mitratel_user_stats');
        const storedPids = localStorage.getItem('mitratel_verified_pids');
        if(storedStats) this.stats = JSON.parse(storedStats);
        if(storedPids) this.verifiedPids = JSON.parse(storedPids);
        this.updateUI();
    },

    addXP: function(amount, reason) {
        this.stats.xp += amount;
        this.checkLevelUp();
        this.save();
        this.updateUI();
        showToast(`+${amount} XP: ${reason}`, 'success');
    },

    checkLevelUp: function() {
        // Logika level sederhana: Level = 1 + floor(XP / 500)
        const newLevel = 1 + Math.floor(this.stats.xp / 500);
        if (newLevel > this.stats.level) {
            this.stats.level = newLevel;
            showToast(`Level Up! You are now level ${newLevel}`, 'info');
        }
    },

    markVerified: function(pid) {
        if(!this.verifiedPids.includes(pid)) {
            this.verifiedPids.push(pid);
            this.stats.verifiedCount++;
            this.addXP(50, "Manual Verification"); // Bonus XP
            this.save();
            return true;
        }
        return false;
    },

    unmarkVerified: function(pid) {
        const idx = this.verifiedPids.indexOf(pid);
        if(idx > -1) {
            this.verifiedPids.splice(idx, 1);
            this.stats.verifiedCount = Math.max(0, this.stats.verifiedCount - 1);
            this.save();
            this.updateUI();
            return true;
        }
        return false;
    },

    isVerified: function(pid) {
        return this.verifiedPids.includes(pid);
    },

    getRankName: function() {
        const lvl = this.stats.level;
        if(lvl < 2) return "Intern Validator";
        if(lvl < 5) return "Junior Officer";
        if(lvl < 10) return "Senior Asset Mgr";
        if(lvl < 20) return "VP of Towers";
        return "Master Validator";
    },

    save: function() {
        localStorage.setItem('mitratel_user_stats', JSON.stringify(this.stats));
        localStorage.setItem('mitratel_verified_pids', JSON.stringify(this.verifiedPids));
    },

    updateUI: function() {
        const levelEl = document.getElementById('userLevel');
        const xpEl = document.getElementById('userXp');
        const rankEl = document.getElementById('userRank');
        const xpBarEl = document.getElementById('xpBar');

        // Pastikan elemen UI ada sebelum diupdate (mencegah error saat loading awal)
        if(levelEl) levelEl.innerText = `Lvl ${this.stats.level}`;
        if(xpEl) xpEl.innerText = this.stats.xp;
        if(rankEl) rankEl.innerText = this.getRankName();
        
        if(xpBarEl) {
            const currentLevelXp = this.stats.xp % 500;
            const percentage = (currentLevelXp / 500) * 100;
            xpBarEl.style.width = `${percentage}%`;
        }
    }
};