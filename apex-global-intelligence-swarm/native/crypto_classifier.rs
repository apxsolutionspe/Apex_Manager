//! APEX native crypto-announcement screening. Offline. No wallets, network, transactions or mining.
use std::io::{self, BufRead, Write};

fn includes_any(words: &[&str], list: &[&str]) -> bool {
    list.iter().any(|v| words.contains(v))
}
pub fn classify(title: &str) -> &'static str {
    let lower = title.to_lowercase();
    if lower.len() > 500 { return "manual_review_required"; }
    let words: Vec<&str> = lower.split(|c: char| !c.is_alphanumeric()).filter(|x| !x.is_empty()).collect();
    if lower.contains("seed phrase") || lower.contains("private key") || lower.contains("recovery phrase")
        || includes_any(&words, &["password", "seed", "phishing", "contraseña"]) {
        return "security_warning";
    }
    if includes_any(&words, &["trade", "trading", "deposit", "depositar", "compra", "comprar", "purchase",
        "buy", "stake", "staking", "swap", "swaps", "leverage", "futures", "perps", "margin",
        "liquidity", "lend", "lending", "borrow", "borrowing", "yield", "volume",
        "mining", "mine", "subscribe", "subscription", "inversión", "invertir",
        "operar", "trades", "trader", "fee", "fees", "collateral", "vault", "vaults"]) {
        return "requires_capital_or_activity_review";
    }
    if includes_any(&words, &["contest", "challenge", "sweepstakes", "quiz", "grant", "grants",
        "raffle", "competition", "vote", "voting", "governance", "quest", "quests",
        "concurso", "sorteo", "beca", "funding", "leaderboard"]) {
        return "manual_action_or_conditions";
    }
    "eligibility_not_verified"
}
fn main() -> io::Result<()> {
    let input = io::stdin();
    let stdout = io::stdout();
    let mut output = io::BufWriter::new(stdout.lock());
    for item in input.lock().lines().take(100) {
        let item = item?;
        writeln!(output, "{}", classify(&item))?;
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn flags_capital(){assert_eq!(classify("Stake ETH to earn rewards"),"requires_capital_or_activity_review");}
    #[test] fn detects_defi_risk(){assert_eq!(classify("Yield on a collateral vault"),"requires_capital_or_activity_review");}
    #[test] fn detects_manual(){assert_eq!(classify("Airdrop quiz and giveaway contest"),"manual_action_or_conditions");}
    #[test] fn flags_secret_theft(){assert_eq!(classify("Enter your seed phrase to claim"),"security_warning");}
    #[test] fn no_auto_claim(){assert_eq!(classify("Official token distribution"),"eligibility_not_verified");}
    #[test] fn handles_unicode(){assert_eq!(classify("Depósito de criptos y comisión"),"eligibility_not_verified");}
    #[test] fn token_boundaries(){assert_eq!(classify("Stakeholders discuss OP ecosystem"),"eligibility_not_verified");}
}
