module.exports = function parseAmount(input, maxAmount) {
    if (!input) return 0;
    input = input.toString().toLowerCase().trim();
    
    if (input === 'max' || input === 'all') return maxAmount;
    
    if (input.endsWith('%')) {
        const percent = parseFloat(input.replace('%', ''));
        if (isNaN(percent) || percent < 0) return 0;
        // Cap at 100%
        const finalPercent = percent > 100 ? 100 : percent;
        return Math.floor(maxAmount * (finalPercent / 100));
    }
    
    if (input.endsWith('k')) {
        const num = parseFloat(input.replace('k', ''));
        if (isNaN(num)) return 0;
        return Math.floor(num * 1000);
    }
    
    if (input.endsWith('m')) {
        const num = parseFloat(input.replace('m', ''));
        if (isNaN(num)) return 0;
        return Math.floor(num * 1000000);
    }
    
    if (input.endsWith('b')) {
        const num = parseFloat(input.replace('b', ''));
        if (isNaN(num)) return 0;
        return Math.floor(num * 1000000000);
    }
    
    const num = parseInt(input, 10);
    return isNaN(num) ? 0 : num;
}
