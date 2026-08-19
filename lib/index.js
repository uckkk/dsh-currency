// dsh-currency — 货币格式化与换算（内置参考汇率，非实时）。纯 Node。
import { defineTool } from "@deepseek-ai/dsh-tools";

const name = "货币工具";
const inject = ["tools"];

// 以 USD 为基准的参考汇率（非实时，仅供估算；可被 currency_convert 的 rates 覆盖）
const BASE_RATES = {
  USD: 1,
  CNY: 7.2,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 149.0,
  KRW: 1330.0,
  HKD: 7.8,
  TWD: 31.5,
  SGD: 1.34,
  AUD: 1.52,
  CAD: 1.36,
  CHF: 0.88,
  INR: 83.5,
  RUB: 92.0,
  BRL: 5.0,
  MXN: 17.0,
  THB: 35.5,
  VND: 24500,
};

const SYMBOLS = {
  USD: "$", CNY: "¥", EUR: "€", GBP: "£", JPY: "¥", KRW: "₩", HKD: "HK$", TWD: "NT$", SGD: "S$", AUD: "A$", CAD: "C$", CHF: "CHF", INR: "₹", RUB: "₽", BRL: "R$", MXN: "MX$", THB: "฿", VND: "₫",
};

function formatCurrency(amount, { currency = "USD", symbol, decimals, thousands = true, locale } = {}) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) throw new Error("amount 必须为数字");
  const dec = decimals ?? (currency === "JPY" || currency === "KRW" || currency === "VND" ? 0 : 2);
  let s;
  if (locale) {
    s = amount.toLocaleString(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  } else {
    s = amount.toFixed(dec);
    if (thousands) {
      const [int, frac] = s.split(".");
      s = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? "." + frac : "");
    }
  }
  const sym = symbol ?? SYMBOLS[currency] ?? currency + " ";
  return `${sym}${s}`;
}

function convertCurrency(amount, from, to, rates = BASE_RATES) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) throw new Error("amount 必须为数字");
  const fromCode = String(from).toUpperCase();
  const toCode = String(to).toUpperCase();
  if (!rates[fromCode]) throw new Error(`未知货币代码：${fromCode}`);
  if (!rates[toCode]) throw new Error(`未知货币代码：${toCode}`);
  const usd = amount / rates[fromCode];
  return usd * rates[toCode];
}

async function apply(ctx, _config) {
  ctx.tools.register(defineTool({
    name: "currency_format",
    description: "格式化金额为货币字符串。`currency` 传货币代码（如 USD/CNY/EUR），自动选符号与小数位；`symbol` 可覆盖符号，`decimals` 可覆盖小数位。",
    parameters: {
      amount: { type: "number", required: true, description: "金额。" },
      currency: { type: "string", description: "货币代码，默认 USD。" },
      symbol: { type: "string", description: "自定义符号，默认按货币代码。" },
      decimals: { type: "integer", description: "小数位，默认按货币（JPY/KRW/VND 为 0，其余 2）。" },
    },
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: { formatted: { type: "string", required: true }, currency: { type: "string", required: true } },
      },
      render: (_a, v) => [{ type: "text", text: `${v.currency} ${v.formatted}` }],
    },
    execute: async (args) => {
      const currency = String(args.currency || "USD").toUpperCase();
      return { formatted: formatCurrency(args.amount, { currency, symbol: args.symbol, decimals: args.decimals }), currency };
    },
  }));

  ctx.tools.register(defineTool({
    name: "currency_convert",
    description: "货币换算（内置参考汇率，非实时，仅供估算）。`from`/`to` 传货币代码，`amount` 传金额。",
    parameters: {
      amount: { type: "number", required: true, description: "金额。" },
      from: { type: "string", required: true, description: "源货币代码，如 CNY。" },
      to: { type: "string", required: true, description: "目标货币代码，如 USD。" },
    },
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: {
          amount: { type: "number", required: true }, from: { type: "string", required: true }, to: { type: "string", required: true },
          result: { type: "number", required: true }, rate: { type: "number", required: true },
        },
      },
      render: (_a, v) => [{ type: "text", text: `${v.amount} ${v.from} = ${v.result.toFixed(4)} ${v.to}（汇率 ${v.rate}）` }],
    },
    execute: async (args) => {
      const from = String(args.from).toUpperCase();
      const to = String(args.to).toUpperCase();
      const rate = BASE_RATES[to] / BASE_RATES[from];
      const result = convertCurrency(args.amount, from, to);
      return { amount: args.amount, from, to, result: Math.round(result * 10000) / 10000, rate: Math.round(rate * 10000) / 10000 };
    },
  }));

  ctx.tools.register(defineTool({
    name: "currency_list",
    description: "列出内置支持的货币代码与符号。",
    parameters: {},
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: { currencies: { type: "array", required: true, items: { type: "object", additionalProperties: false, properties: { code: { type: "string", required: true }, symbol: { type: "string", required: true } } } } },
      },
      render: (_a, v) => [{ type: "text", text: v.currencies.map((c) => `${c.code} ${c.symbol}`).join("  ") }],
    },
    execute: async () => ({ currencies: Object.keys(BASE_RATES).map((code) => ({ code, symbol: SYMBOLS[code] || "" })) }),
  }));
}

export { apply, inject, name };
