const axios = require('axios');

async function getFirstPairAddress() {
    const url = "https://api.dex3.ai/tokenlist/search";
    const body = {
        input: "A3qEKsRTrF6BnbNSRBZWorN9DMqdmqqJxrymyTFjpump", // hoặc thay input theo ý bạn
        type: "tokens"
    };
    try {
        const res = await axios.post(url, body, {
            headers: {
                "Content-Type": "application/json",
                // Thêm các headers khác nếu API yêu cầu, ví dụ Authorization, cookie, ...
            }
        });

        const data = res.data?.data || [];
        if (data.length === 0) {
            console.log("Không có pair nào trong kết quả trả về!");
            return;
        }
        const firstPair = data[0];
        console.log("Pair đầu tiên:");
        console.log("Pair Address:", firstPair.pair_address);
        console.log("DEX:", firstPair.dex);
        console.log("Symbol:", firstPair.token_symbol);
        // In ra các trường khác nếu cần

    } catch (err) {
        if (err.response && err.response.data) {
            console.error('❌ Lỗi API:', JSON.stringify(err.response.data));
        } else {
            console.error('❌ Lỗi khác:', err.message);
        }
    }
}

// Test với nhiều token khác nhau
async function testMultipleTokens() {
    const testTokens = [
        "A3qEKsRTrF6BnbNSRBZWorN9DMqdmqqJxrymyTFjpump",
        "9bRHE7sPsFfDvSgFufcHyekNtvN3dFdyMBffT3CAHR3P",
        "2SCXwm9Nbhta6w5sDwA2D61A3kgLLpMjYAAJjRP9StBR",
        "Nzj87dDNPtALb5EUkrpN36VhmLz4WQ5MuWjrep6pump"
    ];

    console.log("🔍 Test Search API với nhiều token:\n");

    for (const token of testTokens) {
        console.log(`\n📍 Testing token: ${token}`);
        await searchPairByToken(token);
        console.log("─".repeat(80));
    }
}

// Hàm search pair address từ token
async function searchPairByToken(tokenInput) {
    const url = "https://api.dex3.ai/tokenlist/search";
    const body = {
        input: tokenInput,
        type: "tokens"
    };
    
    try {
        const res = await axios.post(url, body, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = res.data?.data || [];
        if (data.length === 0) {
            console.log("❌ Không có pair nào trong kết quả trả về!");
            return null;
        }
        
        console.log(`✅ Tìm thấy ${data.length} kết quả:`);
        
        // Hiển thị tất cả kết quả
        data.forEach((pair, index) => {
            console.log(`  ${index + 1}. Pair: ${pair.pair_address}`);
            console.log(`     DEX: ${pair.dex}`);
            console.log(`     Symbol: ${pair.token_symbol}`);
            console.log(`     Token Address: ${pair.token_address || 'N/A'}`);
            if (index < data.length - 1) console.log();
        });
        
        // Trả về pair đầu tiên
        const firstPair = data[0];
        return {
            pairAddress: firstPair.pair_address,
            dex: firstPair.dex,
            symbol: firstPair.token_symbol,
            tokenAddress: firstPair.token_address
        };
    } catch (err) {
        console.error(`❌ Lỗi search token ${tokenInput}:`, err.message);
        if (err.response && err.response.data) {
            console.error('Chi tiết lỗi:', JSON.stringify(err.response.data, null, 2));
        }
        return null;
    }
}

// Chạy test
console.log("🚀 Bắt đầu test Search API...\n");
testMultipleTokens().then(() => {
    console.log("\n✅ Hoàn thành test!");
}).catch(err => {
    console.error("❌ Lỗi trong quá trình test:", err.message);
});
