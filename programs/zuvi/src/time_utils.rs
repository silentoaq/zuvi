pub struct TimeUtils;

impl TimeUtils {
    /// 判斷給定年份是否為閏年
    pub fn is_leap_year(year: i32) -> bool {
        (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
    }

    /// 取得指定月份的天數
    pub fn days_in_month(year: i32, month: u32) -> u32 {
        match month {
            1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
            4 | 6 | 9 | 11 => 30,
            2 => if Self::is_leap_year(year) { 29 } else { 28 },
            _ => 0,
        }
    }

    /// 從Unix時間戳轉換為年月日
    pub fn timestamp_to_date(timestamp: i64) -> (i32, u32, u32) {
        let days_since_epoch = timestamp / 86400;
        let mut year = 1970;
        let mut remaining_days = days_since_epoch;

        // 計算年份
        loop {
            let days_in_year = if Self::is_leap_year(year) { 366 } else { 365 };
            if remaining_days < days_in_year {
                break;
            }
            remaining_days -= days_in_year;
            year += 1;
        }

        // 計算月份和日期
        let mut month = 1;
        while month <= 12 {
            let days_in_current_month = Self::days_in_month(year, month);
            if remaining_days < days_in_current_month as i64 {
                break;
            }
            remaining_days -= days_in_current_month as i64;
            month += 1;
        }

        let day = (remaining_days + 1) as u32;
        (year, month, day)
    }

    /// 從年月日轉換為Unix時間戳（UTC午夜）
    pub fn date_to_timestamp(year: i32, month: u32, day: u32) -> i64 {
        let mut days = 0i64;

        // 計算從1970年到指定年份的天數
        for y in 1970..year {
            days += if Self::is_leap_year(y) { 366 } else { 365 };
        }

        // 加上當年到指定月份的天數
        for m in 1..month {
            days += Self::days_in_month(year, m) as i64;
        }

        // 加上當月的天數（減1因為從第1天開始）
        days += (day - 1) as i64;

        days * 86400 // 轉換為秒
    }

    /// 計算下次租金到期日
    pub fn calculate_next_payment_due(
        lease_start: i64,
        payment_day: u8,
        paid_months: u32,
    ) -> i64 {
        let (start_year, start_month, _) = Self::timestamp_to_date(lease_start);
        
        // 計算目標月份
        let total_months = (start_month - 1) + paid_months + 1; // +1 for next payment
        let target_year = start_year + (total_months / 12) as i32;
        let target_month = (total_months % 12) + 1;

        // 確保payment_day不超過該月的天數
        let max_day_in_month = Self::days_in_month(target_year, target_month);
        let actual_payment_day = (payment_day as u32).min(max_day_in_month);

        Self::date_to_timestamp(target_year, target_month, actual_payment_day)
    }

    /// 檢查租金是否到期
    pub fn is_rent_due(
        current_time: i64,
        lease_start: i64,
        payment_day: u8,
        paid_months: u32,
    ) -> bool {
        let next_due_date = Self::calculate_next_payment_due(lease_start, payment_day, paid_months);
        current_time >= next_due_date
    }

    /// 計算已經應該支付的月數
    pub fn calculate_months_due(
        current_time: i64,
        lease_start: i64,
        payment_day: u8,
    ) -> u32 {
        let mut months_due = 0;
        
        loop {
            let next_due = Self::calculate_next_payment_due(lease_start, payment_day, months_due);
            if current_time < next_due {
                break;
            }
            months_due += 1;
        }
        
        months_due
    }
}