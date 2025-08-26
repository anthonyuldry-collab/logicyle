export const getAgeCategory = (birthDate?: string): { category: string; age: number | null } => {
    if (!birthDate || typeof birthDate !== 'string') {
        return { category: 'N/A', age: null };
    }
    
    // Robust date parsing to avoid timezone issues.
    const parts = birthDate.split('-').map(p => parseInt(p, 10));
    if (parts.length !== 3 || parts.some(isNaN)) {
        return { category: 'N/A', age: null };
    }
    const [year, month, day] = parts;
    const birth = new Date(Date.UTC(year, month - 1, day));
    
    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    
    let age = utcToday.getUTCFullYear() - birth.getUTCFullYear();
    const m = utcToday.getUTCMonth() - birth.getUTCMonth();
    if (m < 0 || (m === 0 && utcToday.getUTCDate() < birth.getUTCDate())) {
        age--;
    }
    
    if (age < 0 || age > 120) { // Sanity check
        return { category: 'N/A', age: null };
    }

    let category = 'Senior';
    if (age <= 14) category = 'U15';
    else if (age <= 16) category = 'U17';
    else if (age <= 18) category = 'U19';
    else if (age <= 22) category = 'U23';
    
    return { category, age };
};
