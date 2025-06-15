const axios = require('axios');
const ExcelJS = require('exceljs');
const fs = require('fs');

function getStartOfTodayUTCTimestamp() {
    const now = new Date();
    // Tạo object Date ở 00:00:00 UTC hôm nay
    const startOfToday = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
    ));
    return Math.floor(startOfToday.getTime() / 1000);
}

const toTimestamp = getStartOfTodayUTCTimestamp();
console.log('Timestamp đầu ngày hôm nay (UTC):', toTimestamp, '- Date:', new Date(toTimestamp * 1000).toISOString());

// Tiêu chí % lệch để xác định "GẦN ĐÚNG" (có thể thay đổi dễ dàng)
// Ví dụ: 0.5 = 0.5%, 1.0 = 1%, 2.0 = 2%
const ACCEPTABLE_DIFF_PERCENT = 5; // 0.5% = gần đúng

// Mảng để lưu kết quả
const results = [];

// Hàm tính toán thời gian từ firstTime đến ATH và định dạng thành HH:MM:SS
function calculateTimeToATH(firstTimeStr, athTimestamp) {
    if (!firstTimeStr || !athTimestamp) {
        return null;
    }

    try {
        // Chuyển đổi firstTime thành timestamp
        let firstTimeMs;
        if (typeof firstTimeStr === 'string' && firstTimeStr.includes('T')) {
            firstTimeMs = new Date(firstTimeStr).getTime();
        } else {
            // Nếu là số timestamp
            firstTimeMs = new Date(parseFloat(firstTimeStr) * 1000).getTime();
        }

        // Chuyển đổi athTimestamp thành timestamp
        let athTimeMs;
        if (typeof athTimestamp === 'string' && athTimestamp.includes('T')) {
            athTimeMs = new Date(athTimestamp).getTime();
        } else {
            athTimeMs = new Date(parseFloat(athTimestamp) * 1000).getTime();
        }

        // Tính khoảng cách thời gian (milliseconds)
        const diffMs = athTimeMs - firstTimeMs;

        if (diffMs < 0) {
            return "00:00:00"; // Nếu ATH xảy ra trước firstTime
        }

        // Chuyển đổi thành giờ:phút:giây
        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        // Định dạng thành HH:MM:SS
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } catch (error) {
        console.error('Lỗi khi tính toán Time to ATH:', error);
        return null;
    }
}

// Đọc dữ liệu từ file Excel
async function readExcelFile() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('./Data.xlsx');
    const worksheet = workbook.getWorksheet(1);
    
    const excelData = [];
    const headers = [];
    
    // Lấy headers từ dòng đầu tiên
    worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value;
    });
    
    // Lấy dữ liệu từ các dòng tiếp theo
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Bỏ qua header row
            const rowData = {};
            row.eachCell((cell, colNumber) => {
                const header = headers[colNumber];
                if (header) {
                    rowData[header] = cell.value;
                }
            });
            excelData.push(rowData);
        }
    });
    
    return excelData;
}

// Hàm gọi API để lấy dữ liệu candle
async function fetchCandleData(pairAddress, from, to) {
    const url = "https://api.dex3.ai/ohlcv";
    const body = {
        network: "solana",
        pair: pairAddress,
        timestamp: Math.floor(Date.now() / 1000),
        from: from,
        to: to,
        vsToken: "USDC",
        interval: 60,
        cb: 1440, //86400
        first: true,
        isMC: true,
        _: new Date().toISOString()
    };

    try {
        const res = await axios.post(url, body, {
            headers: {
                "accept": "application/json",
                "accept-language": "en-US,en;q=0.9,vi;q=0.8",
                "access-control-allow-origin": "*",
                "clienttimestamp": Date.now().toString(),
                "content-type": "application/json",
                "origin": "https://dex3.ai",
                "referer": "https://dex3.ai/",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
            }
        });

        return res.data?.data || [];
    } catch (err) {
        console.error(`❌ Lỗi API cho pair ${pairAddress}:`, err.message);
        return [];
    }
}

// Hàm gọi API để lấy thông tin pair thay thế khi kết quả sai
async function fetchAlternativePairInfo(pairAddress) {
    const url = "https://api.dex3.fi/token/detail/basic-info";
    const body = {
        pairAddress: pairAddress
    };

    try {
        const res = await axios.post(url, body, {
            headers: {
                "Content-Type": "application/json",
                "Cookie": "AWSALB=qwtgQ8dVw0p8d9ancoWHI1P79C2Y0Jj70AotTlN5Sz67ktNSJ8/mt8LeYm2OS++Q73aKIHtyYk2cNdjKCtEtK/+dfWnWs+Sq2rrbf6s1e8c9N6NWM3MjM5AT0Uin; AWSALBCORS=qwtgQ8dVw0p8d9ancoWHI1P79C2Y0Jj70AotTlN5Sz67ktNSJ8/mt8LeYm2OS++Q73aKIHtyYk2cNdjKCtEtK/+dfWnWs+Sq2rrbf6s1e8c9N6NWM3MjM5AT0Uin; AWSALB=wGDn35/M06P+f2II376DNEb6eYXe4bMH1YYkALDu6lfsIxM/krgpmKEvcxL03qQkegr031dsOcG+7WoVazVAhDxgIDRDobH4O6EpQW/Ez+jSgJ0k/d3GDCM6rZPR; AWSALBCORS=wGDn35/M06P+f2II376DNEb6eYXe4bMH1YYkALDu6lfsIxM/krgpmKEvcxL03qQkegr031dsOcG+7WoVazVAhDxgIDRDobH4O6EpQW/Ez+jSgJ0k/d3GDCM6rZPR"
            }
        });

        return res.data || null;
    } catch (err) {
        console.error(`❌ Lỗi API thay thế cho pair ${pairAddress}:`, err.message);
        return null;
    }
}

async function callApiForEachRow() {
    const excelData = await readExcelFile();
    
    for (const [index, row] of excelData.entries()) {
        const tokenCA = row['Token']; // Cột đầu tiên - CA token
        const pairAddress = row['Pair Address'];
        let firstTime = row['First Time'];

        // Chuyển First Time về unix timestamp (giây)
        let fromTimestamp;
        if (typeof firstTime === 'number') {
            fromTimestamp = firstTime;
        } else {
            fromTimestamp = Math.floor(new Date(firstTime).getTime() / 1000);
        }

        // Nếu thiếu dữ liệu thì bỏ qua dòng đó
        if (!pairAddress || !fromTimestamp) {
            console.warn(`⚠️ Dòng ${index + 2}: Thiếu Pair Address hoặc First Time`);
            continue;
        }

        const symbol = row['Symbol'];
        const signer = row['Signer'];
        const athTimestampExcel = row['ATH Timestamp'];

        // Chuyển đổi First Time thành string để hiển thị
        const firstTimeStr = typeof firstTime === 'number' 
            ? new Date(firstTime * 1000).toISOString()
            : firstTime;

        console.log(`\n🔹 Dòng ${index + 2} | Pair: ${pairAddress} | From: ${fromTimestamp} | To: ${toTimestamp}`);
        console.log(`Symbol: ${symbol}`);
        console.log(`Signer: ${signer}`);
        console.log(`First Time: ${firstTimeStr}`);
        console.log(`ATH Timestamp Excel: ${athTimestampExcel}`);

        try {
            const candles = await fetchCandleData(pairAddress, fromTimestamp, toTimestamp);

            // Xử lý dữ liệu candle
            let candleArray = [];
            if (Array.isArray(candles)) {
                candleArray = candles;
            } else if (candles && candles.candles && Array.isArray(candles.candles)) {
                candleArray = candles.candles;
            } else if (candles && typeof candles === 'object') {
                // Thử tìm array trong object
                const possibleArrays = Object.values(candles).filter(val => Array.isArray(val));
                if (possibleArrays.length > 0) {
                    candleArray = possibleArrays[0];
                }
            }

            if (candleArray && candleArray.length > 0) {
                // Dữ liệu candle có format: [timestamp, open, high, low, close, volume]
                // Lọc candle trong khoảng thời gian từ (fromTimestamp + 1 giây) đến toTimestamp
                const startTime = fromTimestamp + 1; // +1 giây
                const filteredCandles = candleArray.filter(candle => {
                    const candleTimestamp = candle[0];
                    return candleTimestamp >= startTime && candleTimestamp <= toTimestamp;
                });

                console.log(`📊 Tổng số candle: ${candleArray.length}, Sau khi filter: ${filteredCandles.length}`);
                console.log(`⏰ Khoảng thời gian filter: ${new Date(startTime * 1000).toISOString()} đến ${new Date(toTimestamp * 1000).toISOString()}`);

                if (filteredCandles.length > 0) {
                    const maxHigh = Math.max(...filteredCandles.map(candle => parseFloat(candle[2])));
                    const maxHighCandle = filteredCandles.find(candle => parseFloat(candle[2]) === maxHigh);
                    const maxHighTimeString = new Date(maxHighCandle[0] * 1000).toISOString();

                const athMcapExcel = parseFloat(row['ATH MCap']);

                if (maxHigh !== null) {
                    const diff = athMcapExcel !== 0 ? (maxHigh - athMcapExcel) / athMcapExcel * 100 : 0;
                    const isNearCorrect = Math.abs(diff) <= ACCEPTABLE_DIFF_PERCENT;

                    // Tính toán Time to ATH
                    const timeToATH = calculateTimeToATH(firstTimeStr, maxHighTimeString);

                    // Lưu kết quả vào mảng
                    const result = {
                        row: index + 2,
                        tokenCA,
                        pairAddress,
                        symbol,
                        signer,
                        fromTimestamp,
                        toTimestamp,
                        firstTime: firstTimeStr,
                        athTimestampExcel,
                        athMcapExcel,
                        maxHighAPI: maxHigh,
                        maxHighTimestamp: maxHighTimeString,
                        timeToATH: timeToATH,
                        diffPercent: parseFloat(diff.toFixed(2)),
                        status: isNearCorrect ? 'GẦN ĐÚNG' : 'SAI',
                        isNearCorrect
                    };

                    results.push(result);

                    // Hiển thị kết quả so sánh
                    console.log(`ATH MCap Excel:     ${athMcapExcel}`);
                    console.log(`Max High API:       ${maxHigh}`);
                    console.log(`Thời gian Max High: ${maxHighTimeString}`);
                    console.log(`Time to ATH:        ${timeToATH}`);
                    if (isNearCorrect) {
                        console.log(`Lệch:               ${diff.toFixed(2)}% (✅ GẦN ĐÚNG)`);
                    } else {
                        console.log(`Lệch:               ${diff.toFixed(2)}% (❌ SAI)`);

                        // Gọi API thay thế khi kết quả sai
                        console.log(`🔄 Đang lấy thông tin pair thay thế...`);
                        const alternativeInfo = await fetchAlternativePairInfo(pairAddress);
                        if (alternativeInfo && alternativeInfo.data && alternativeInfo.data.migrated_to_pool) {
                            console.log(`📋 Tìm thấy migrated_to_pool: ${alternativeInfo.data.migrated_to_pool}`);

                            // Sử dụng migrated_to_pool để kiểm tra lại
                            const newPairAddress = alternativeInfo.data.migrated_to_pool;
                            result.migratedToPair = newPairAddress; // Chỉ lưu pair thay thế
                            console.log(`🔄 Đang kiểm tra lại với pair mới: ${newPairAddress}`);

                            try {
                                const newCandles = await fetchCandleData(newPairAddress, fromTimestamp, toTimestamp);
                                let newCandleArray = [];

                                if (Array.isArray(newCandles)) {
                                    newCandleArray = newCandles;
                                } else if (newCandles && newCandles.candles && Array.isArray(newCandles.candles)) {
                                    newCandleArray = newCandles.candles;
                                } else if (newCandles && typeof newCandles === 'object') {
                                    const possibleArrays = Object.values(newCandles).filter(val => Array.isArray(val));
                                    if (possibleArrays.length > 0) {
                                        newCandleArray = possibleArrays[0];
                                    }
                                }

                                if (newCandleArray && newCandleArray.length > 0) {
                                    // Lọc candle cho pair mới từ (fromTimestamp + 1 giây) đến toTimestamp
                                    const startTime = fromTimestamp + 1;
                                    const filteredNewCandles = newCandleArray.filter(candle => {
                                        const candleTimestamp = candle[0];
                                        return candleTimestamp >= startTime && candleTimestamp <= toTimestamp;
                                    });

                                    console.log(`📊 Pair mới - Tổng số candle: ${newCandleArray.length}, Sau khi filter: ${filteredNewCandles.length}`);

                                    if (filteredNewCandles.length > 0) {
                                        const newMaxHigh = Math.max(...filteredNewCandles.map(candle => parseFloat(candle[2])));
                                        const newMaxHighCandle = filteredNewCandles.find(candle => parseFloat(candle[2]) === newMaxHigh);
                                        const newMaxHighTimeString = new Date(newMaxHighCandle[0] * 1000).toISOString();

                                    const newDiff = athMcapExcel !== 0 ? (newMaxHigh - athMcapExcel) / athMcapExcel * 100 : 0;
                                    const newIsNearCorrect = Math.abs(newDiff) <= ACCEPTABLE_DIFF_PERCENT;

                                    // Tính toán Time to ATH cho pair mới
                                    const newTimeToATH = calculateTimeToATH(firstTimeStr, newMaxHighTimeString);

                                    console.log(`🔄 KẾT QUẢ VỚI PAIR MỚI:`);
                                    console.log(`Max High API (mới):     ${newMaxHigh}`);
                                    console.log(`Thời gian Max High (mới): ${newMaxHighTimeString}`);
                                    console.log(`Time to ATH (mới):      ${newTimeToATH}`);
                                    console.log(`Lệch (mới):             ${newDiff.toFixed(2)}% (${newIsNearCorrect ? '✅ GẦN ĐÚNG' : '❌ SAI'})`);

                                    // Cập nhật kết quả với thông tin mới
                                    result.newMaxHighAPI = newMaxHigh;
                                    result.newMaxHighTimestamp = newMaxHighTimeString;
                                    result.newTimeToATH = newTimeToATH;
                                    result.newDiffPercent = parseFloat(newDiff.toFixed(2));
                                    result.newStatus = newIsNearCorrect ? 'GẦN ĐÚNG' : 'SAI';
                                    result.newIsNearCorrect = newIsNearCorrect;
                                    } else {
                                        console.log(`⚠️ Không tìm thấy candle cho pair mới sau khi filter`);
                                    }
                                } else {
                                    console.log(`⚠️ Không tìm thấy candle cho pair mới`);
                                }
                            } catch (newErr) {
                                console.error(`❌ Lỗi khi kiểm tra pair mới:`, newErr.message);
                                result.newPairError = newErr.message;
                            }
                        } else {
                            console.log(`⚠️ Không tìm thấy migrated_to_pool hoặc lỗi API thay thế`);
                        }
                    }
                } else {
                    console.log('⚠️ Không tìm thấy candle nào sau khi filter!');
                }
            } else {
                console.log('⚠️ Không tìm thấy candle nào để lấy high!');

                    // Gọi API thay thế khi không tìm thấy candle
                    console.log(`🔄 Đang lấy thông tin pair thay thế...`);
                    const alternativeInfo = await fetchAlternativePairInfo(pairAddress);

                    // Lưu kết quả lỗi vào mảng
                    const result = {
                        row: index + 2,
                        tokenCA,
                        pairAddress,
                        symbol,
                        signer,
                        fromTimestamp,
                        toTimestamp,
                        firstTime: firstTimeStr,
                        athTimestampExcel,
                        athMcapExcel,
                        maxHighAPI: null,
                        maxHighTimestamp: null,
                        diffPercent: null,
                        status: 'LỖI - KHÔNG TÌM THẤY CANDLE',
                        isNearCorrect: false
                    };

                    if (alternativeInfo && alternativeInfo.data && alternativeInfo.data.migrated_to_pool) {
                        console.log(`📋 Tìm thấy migrated_to_pool: ${alternativeInfo.data.migrated_to_pool}`);

                        // Sử dụng migrated_to_pool để kiểm tra lại
                        const newPairAddress = alternativeInfo.data.migrated_to_pool;
                        result.migratedToPair = newPairAddress; // Chỉ lưu pair thay thế
                        console.log(`🔄 Đang kiểm tra lại với pair mới: ${newPairAddress}`);

                        try {
                            const newCandles = await fetchCandleData(newPairAddress, fromTimestamp, toTimestamp);
                            let newCandleArray = [];

                            if (Array.isArray(newCandles)) {
                                newCandleArray = newCandles;
                            } else if (newCandles && newCandles.candles && Array.isArray(newCandles.candles)) {
                                newCandleArray = newCandles.candles;
                            } else if (newCandles && typeof newCandles === 'object') {
                                const possibleArrays = Object.values(newCandles).filter(val => Array.isArray(val));
                                if (possibleArrays.length > 0) {
                                    newCandleArray = possibleArrays[0];
                                }
                            }

                            if (newCandleArray && newCandleArray.length > 0) {
                                const newMaxHigh = Math.max(...newCandleArray.map(candle => parseFloat(candle[2])));
                                const newMaxHighCandle = newCandleArray.find(candle => parseFloat(candle[2]) === newMaxHigh);
                                const newMaxHighTimeString = new Date(newMaxHighCandle[0] * 1000).toISOString();

                                const athMcapExcel = parseFloat(row['ATH MCap']) || 0;
                                const newDiff = athMcapExcel !== 0 ? (newMaxHigh - athMcapExcel) / athMcapExcel * 100 : 0;
                                const newIsNearCorrect = Math.abs(newDiff) <= ACCEPTABLE_DIFF_PERCENT;

                                console.log(`🔄 KẾT QUẢ VỚI PAIR MỚI:`);
                                console.log(`Max High API (mới):     ${newMaxHigh}`);
                                console.log(`Thời gian Max High (mới): ${newMaxHighTimeString}`);
                                console.log(`Lệch (mới):             ${newDiff.toFixed(2)}% (${newIsNearCorrect ? '✅ GẦN ĐÚNG' : '❌ SAI'})`);

                                // Cập nhật kết quả với thông tin mới
                                result.newMaxHighAPI = newMaxHigh;
                                result.newMaxHighTimestamp = newMaxHighTimeString;
                                result.newDiffPercent = parseFloat(newDiff.toFixed(2));
                                result.newStatus = newIsNearCorrect ? 'GẦN ĐÚNG' : 'SAI';
                                result.newIsNearCorrect = newIsNearCorrect;

                                // Cập nhật status chính nếu pair mới cho kết quả tốt hơn
                                if (newIsNearCorrect) {
                                    result.status = 'GẦN ĐÚNG (VỚI PAIR MỚI)';
                                    result.isNearCorrect = true;
                                }
                            } else {
                                console.log(`⚠️ Không tìm thấy candle cho pair mới`);
                            }
                        } catch (newErr) {
                            console.error(`❌ Lỗi khi kiểm tra pair mới:`, newErr.message);
                            result.newPairError = newErr.message;
                        }
                    } else {
                        console.log(`⚠️ Không tìm thấy migrated_to_pool hoặc lỗi API thay thế`);
                    }

                    results.push(result);
                }

            } else {
                console.log('⚠️ Không tìm thấy candle nào để lấy high!');

                // Gọi API thay thế khi không tìm thấy candle
                console.log(`🔄 Đang lấy thông tin pair thay thế...`);
                const alternativeInfo = await fetchAlternativePairInfo(pairAddress);

                // Lưu kết quả lỗi vào mảng
                const result = {
                    row: index + 2,
                    tokenCA,
                    pairAddress,
                    symbol,
                    signer,
                    fromTimestamp,
                    toTimestamp,
                    firstTime: firstTimeStr,
                    athTimestampExcel,
                    athMcapExcel: parseFloat(row['ATH MCap']) || null,
                    maxHighAPI: null,
                    maxHighTimestamp: null,
                    diffPercent: null,
                    status: 'LỖI - KHÔNG TÌM THẤY CANDLE',
                    isNearCorrect: false
                };

                if (alternativeInfo && alternativeInfo.data && alternativeInfo.data.migrated_to_pool) {
                    console.log(`📋 Tìm thấy migrated_to_pool: ${alternativeInfo.data.migrated_to_pool}`);

                    // Sử dụng migrated_to_pool để kiểm tra lại
                    const newPairAddress = alternativeInfo.data.migrated_to_pool;
                    result.migratedToPair = newPairAddress; // Chỉ lưu pair thay thế
                    console.log(`🔄 Đang kiểm tra lại với pair mới: ${newPairAddress}`);

                    try {
                        const newCandles = await fetchCandleData(newPairAddress, fromTimestamp, toTimestamp);
                        let newCandleArray = [];

                        if (Array.isArray(newCandles)) {
                            newCandleArray = newCandles;
                        } else if (newCandles && newCandles.candles && Array.isArray(newCandles.candles)) {
                            newCandleArray = newCandles.candles;
                        } else if (newCandles && typeof newCandles === 'object') {
                            const possibleArrays = Object.values(newCandles).filter(val => Array.isArray(val));
                            if (possibleArrays.length > 0) {
                                newCandleArray = possibleArrays[0];
                            }
                        }

                        if (newCandleArray && newCandleArray.length > 0) {
                            const newMaxHigh = Math.max(...newCandleArray.map(candle => parseFloat(candle[2])));
                            const newMaxHighCandle = newCandleArray.find(candle => parseFloat(candle[2]) === newMaxHigh);
                            const newMaxHighTimeString = new Date(newMaxHighCandle[0] * 1000).toISOString();

                            const athMcapExcel = parseFloat(row['ATH MCap']) || 0;
                            const newDiff = athMcapExcel !== 0 ? (newMaxHigh - athMcapExcel) / athMcapExcel * 100 : 0;
                            const newIsNearCorrect = Math.abs(newDiff) <= ACCEPTABLE_DIFF_PERCENT;

                            console.log(`🔄 KẾT QUẢ VỚI PAIR MỚI:`);
                            console.log(`Max High API (mới):     ${newMaxHigh}`);
                            console.log(`Thời gian Max High (mới): ${newMaxHighTimeString}`);
                            console.log(`Lệch (mới):             ${newDiff.toFixed(2)}% (${newIsNearCorrect ? '✅ GẦN ĐÚNG' : '❌ SAI'})`);

                            // Cập nhật kết quả với thông tin mới
                            result.newMaxHighAPI = newMaxHigh;
                            result.newMaxHighTimestamp = newMaxHighTimeString;
                            result.newDiffPercent = parseFloat(newDiff.toFixed(2));
                            result.newStatus = newIsNearCorrect ? 'GẦN ĐÚNG' : 'SAI';
                            result.newIsNearCorrect = newIsNearCorrect;

                            // Cập nhật status chính nếu pair mới cho kết quả tốt hơn
                            if (newIsNearCorrect) {
                                result.status = 'GẦN ĐÚNG (VỚI PAIR MỚI)';
                                result.isNearCorrect = true;
                            }
                        } else {
                            console.log(`⚠️ Không tìm thấy candle cho pair mới`);
                        }
                    } catch (newErr) {
                        console.error(`❌ Lỗi khi kiểm tra pair mới:`, newErr.message);
                        result.newPairError = newErr.message;
                    }
                } else {
                    console.log(`⚠️ Không tìm thấy migrated_to_pool hoặc lỗi API thay thế`);
                }

                results.push(result);
            }

        } catch (err) {
            if (err.response && err.response.data) {
                console.error('❌ Lỗi API:', JSON.stringify(err.response.data));
            } else {
                console.error('❌ Lỗi khác:', err.message);
            }

            // Gọi API thay thế khi có lỗi API
            console.log(`🔄 Đang lấy thông tin pair thay thế...`);
            const alternativeInfo = await fetchAlternativePairInfo(pairAddress);

            // Lưu kết quả lỗi API vào mảng
            const result = {
                row: index + 2,
                tokenCA,
                pairAddress,
                symbol,
                signer,
                fromTimestamp,
                toTimestamp,
                firstTime: firstTimeStr,
                athTimestampExcel,
                athMcapExcel: parseFloat(row['ATH MCap']) || null,
                maxHighAPI: null,
                maxHighTimestamp: null,
                diffPercent: null,
                status: 'LỖI API',
                isNearCorrect: false,
                error: err.message
            };

            if (alternativeInfo && alternativeInfo.data && alternativeInfo.data.migrated_to_pool) {
                console.log(`📋 Tìm thấy migrated_to_pool: ${alternativeInfo.data.migrated_to_pool}`);

                // Sử dụng migrated_to_pool để kiểm tra lại
                const newPairAddress = alternativeInfo.data.migrated_to_pool;
                result.migratedToPair = newPairAddress; // Chỉ lưu pair thay thế
                console.log(`🔄 Đang kiểm tra lại với pair mới: ${newPairAddress}`);

                try {
                    const newCandles = await fetchCandleData(newPairAddress, fromTimestamp, toTimestamp);
                    let newCandleArray = [];

                    if (Array.isArray(newCandles)) {
                        newCandleArray = newCandles;
                    } else if (newCandles && newCandles.candles && Array.isArray(newCandles.candles)) {
                        newCandleArray = newCandles.candles;
                    } else if (newCandles && typeof newCandles === 'object') {
                        const possibleArrays = Object.values(newCandles).filter(val => Array.isArray(val));
                        if (possibleArrays.length > 0) {
                            newCandleArray = possibleArrays[0];
                        }
                    }

                    if (newCandleArray && newCandleArray.length > 0) {
                        const newMaxHigh = Math.max(...newCandleArray.map(candle => parseFloat(candle[2])));
                        const newMaxHighCandle = newCandleArray.find(candle => parseFloat(candle[2]) === newMaxHigh);
                        const newMaxHighTimeString = new Date(newMaxHighCandle[0] * 1000).toISOString();

                        const athMcapExcel = parseFloat(row['ATH MCap']) || 0;
                        const newDiff = athMcapExcel !== 0 ? (newMaxHigh - athMcapExcel) / athMcapExcel * 100 : 0;
                        const newIsNearCorrect = Math.abs(newDiff) <= ACCEPTABLE_DIFF_PERCENT;

                        console.log(`🔄 KẾT QUẢ VỚI PAIR MỚI:`);
                        console.log(`Max High API (mới):     ${newMaxHigh}`);
                        console.log(`Thời gian Max High (mới): ${newMaxHighTimeString}`);
                        console.log(`Lệch (mới):             ${newDiff.toFixed(2)}% (${newIsNearCorrect ? '✅ GẦN ĐÚNG' : '❌ SAI'})`);

                        // Cập nhật kết quả với thông tin mới
                        result.newMaxHighAPI = newMaxHigh;
                        result.newMaxHighTimestamp = newMaxHighTimeString;
                        result.newDiffPercent = parseFloat(newDiff.toFixed(2));
                        result.newStatus = newIsNearCorrect ? 'GẦN ĐÚNG' : 'SAI';
                        result.newIsNearCorrect = newIsNearCorrect;

                        // Cập nhật status chính nếu pair mới cho kết quả tốt hơn
                        if (newIsNearCorrect) {
                            result.status = 'GẦN ĐÚNG (VỚI PAIR MỚI)';
                            result.isNearCorrect = true;
                        }
                    } else {
                        console.log(`⚠️ Không tìm thấy candle cho pair mới`);
                    }
                } catch (newErr) {
                    console.error(`❌ Lỗi khi kiểm tra pair mới:`, newErr.message);
                    result.newPairError = newErr.message;
                }
            } else {
                console.log(`⚠️ Không tìm thấy migrated_to_pool hoặc lỗi API thay thế`);
            }

            results.push(result);
        }
    }

    // Xuất kết quả ra file JSON
    const outputData = {
        metadata: {
            timestamp: new Date().toISOString(),
            totalRows: results.length,
            summary: {
                nearCorrect: results.filter(r => r.isNearCorrect).length,
                incorrect: results.filter(r => r.status === 'SAI').length,
                errors: results.filter(r => r.status.includes('LỖI')).length
            }
        },
        results: results
    };

    const fileName = `compareDataResult.json`;
    fs.writeFileSync(fileName, JSON.stringify(outputData, null, 2), 'utf8');
    
    // Xuất kết quả ra file Excel
    const excelFileName = await exportToExcel(results, outputData.metadata);

    console.log(`\n📊 TỔNG KẾT:`);
    console.log(`✅ Gần đúng: ${outputData.metadata.summary.nearCorrect}`);
    console.log(`❌ Sai: ${outputData.metadata.summary.incorrect}`);
    console.log(`⚠️ Lỗi: ${outputData.metadata.summary.errors}`);
    console.log(`📁 Đã xuất kết quả ra file JSON: ${fileName}`);
    console.log(`📁 Đã xuất kết quả ra file Excel: ${excelFileName}`);
}

// Thêm hàm để xuất kết quả ra file Excel
async function exportToExcel(results, metadata) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Kết quả so sánh');
    
    // Định nghĩa các cột
    worksheet.columns = [
        { header: 'Dòng', key: 'row', width: 8 },
        { header: 'Token CA', key: 'tokenCA', width: 45 },
        { header: 'Pair Address', key: 'pairAddress', width: 45 },
        { header: 'Symbol', key: 'symbol', width: 12 },
        { header: 'Signer', key: 'signer', width: 45 },
        { header: 'First Time', key: 'firstTime', width: 25 },
        { header: 'ATH MCap Excel', key: 'athMcapExcel', width: 15 },
        { header: 'Max High API', key: 'maxHighAPI', width: 15 },
        { header: 'Max High Timestamp', key: 'maxHighTimestamp', width: 25 },
        { header: 'Time to ATH', key: 'timeToATH', width: 12 },
        { header: 'Lệch %', key: 'diffPercent', width: 10 },
        { header: 'Trạng thái', key: 'status', width: 20 },
        { header: 'Migrated To Pair', key: 'migratedToPair', width: 45 },
        { header: 'Max High API (mới)', key: 'newMaxHighAPI', width: 15 },
        { header: 'Max High Timestamp (mới)', key: 'newMaxHighTimestamp', width: 25 },
        { header: 'Time to ATH (mới)', key: 'newTimeToATH', width: 12 },
        { header: 'Lệch % (mới)', key: 'newDiffPercent', width: 10 },
        { header: 'Trạng thái (mới)', key: 'newStatus', width: 20 }
    ];
    
    // Thêm dữ liệu
    results.forEach(result => {
        worksheet.addRow(result);
    });
    
    // Định dạng header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Định dạng các cột trạng thái
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            // Định dạng cột trạng thái chính
            const statusCell = row.getCell('status');
            if (statusCell.value && statusCell.value.includes('GẦN ĐÚNG')) {
                statusCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF90EE90' } // Light green
                };
            } else if (statusCell.value && statusCell.value.includes('SAI')) {
                statusCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFCCCB' } // Light red
                };
            } else if (statusCell.value && statusCell.value.includes('LỖI')) {
                statusCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFD700' } // Gold/yellow
                };
            }
            
            // Định dạng cột trạng thái mới
            const newStatusCell = row.getCell('newStatus');
            if (newStatusCell.value && newStatusCell.value.includes('GẦN ĐÚNG')) {
                newStatusCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF90EE90' } // Light green
                };
            } else if (newStatusCell.value && newStatusCell.value.includes('SAI')) {
                newStatusCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFCCCB' } // Light red
                };
            }
        }
    });
    
    // Thêm sheet tổng kết
    const summarySheet = workbook.addWorksheet('Tổng kết');
    summarySheet.columns = [
        { header: 'Thông tin', key: 'info', width: 30 },
        { header: 'Giá trị', key: 'value', width: 15 }
    ];
    
    summarySheet.addRow({ info: 'Thời gian xuất', value: metadata.timestamp });
    summarySheet.addRow({ info: 'Tổng số dòng', value: metadata.totalRows });
    summarySheet.addRow({ info: 'Số kết quả gần đúng', value: metadata.summary.nearCorrect });
    summarySheet.addRow({ info: 'Số kết quả sai', value: metadata.summary.incorrect });
    summarySheet.addRow({ info: 'Số lỗi', value: metadata.summary.errors });
    summarySheet.addRow({ info: 'Tỷ lệ chính xác', value: `${((metadata.summary.nearCorrect / metadata.totalRows) * 100).toFixed(2)}%` });
    
    summarySheet.getColumn('info').font = { bold: true };
    
    // Lưu file
    const excelFileName = `compareDataResult_${new Date().toISOString().slice(0,10)}.xlsx`;
    await workbook.xlsx.writeFile(excelFileName);
    
    return excelFileName;
}

callApiForEachRow();
