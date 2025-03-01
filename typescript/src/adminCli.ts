import {parseTypeTagOrThrow, strToU8, sendPayloadTx, U8} from "@manahippo/move-to-ts";
import {AptosAccount, AptosClient, HexString, Types} from "aptos";
import { Command } from "commander";
import { App, stdlib } from "./src";
import * as fs from "fs";
import * as yaml from "yaml";
import { REQUESTS } from "./requestList";
import { RawCoinInfo } from "./list";
import bigInt from "big-integer";

export const readConfig = (program: Command) => {
  const {config, profile} = program.opts();
  const ymlContent = fs.readFileSync(config, {encoding: "utf-8"});
  const result = yaml.parse(ymlContent);
  //console.log(result);
  if (!result.profiles) {
    throw new Error("Expect a profiles to be present in yaml config");
  }
  if (!result.profiles[profile]) {
    throw new Error(`Expect a ${profile} profile to be present in yaml config`);
  }
  const url = result.profiles[profile].rest_url;
  const privateKeyStr = result.profiles[profile].private_key;
  if (!url) {
    throw new Error(`Expect rest_url to be present in ${profile} profile`);
  }
  if (!privateKeyStr) {
    throw new Error(`Expect private_key to be present in ${profile} profile`);
  }
  const privateKey = new HexString(privateKeyStr);
  const client = new AptosClient(result.profiles[profile].rest_url);
  const account = new AptosAccount(privateKey.toUint8Array());
  console.log(`Using address ${account.address().hex()}`);
  return {client, account};
}

const program = new Command();

program
  .name('yarn adminCli')
  .requiredOption('-c, --config <path>', 'path to your aptos config.yml (generated with "aptos init")')
  .option('-p, --profile <PROFILE>', 'aptos config profile to use', 'default')

const consoleTransactionResult = (prefix:string, info: RawCoinInfo, res: Types.UserTransaction) => {
  console.log(prefix +" " + info.token_type.type + " "+ res.success)
  if (!res.success){
    console.log(res.vm_status)
  }
}

const makeStr = (s: string) => {
  return new stdlib.String.String({bytes: strToU8(s)}, stdlib.String.String.getTag())
}

const approveCoin = async(info: RawCoinInfo, isUpdate: boolean) => {
  const {client, account} = readConfig(program);
  const CoinType = parseTypeTagOrThrow(info.token_type.type);

  const app = new App(client).coin_list.coin_list;
  let res = await app.add_to_registry_by_approver(
      account,
      makeStr(info.name),
      makeStr(info.symbol),
      makeStr(info.coingecko_id),
      makeStr(info.logo_url),
      makeStr(info.project_url),
      isUpdate,
      [CoinType])
  consoleTransactionResult(isUpdate?"Update":"Approve", info, res)
  
  if (!isUpdate) {
    res = await app.add_to_list(account,app.moduleAddress, [CoinType])
    consoleTransactionResult("Add to list", info, res)
  }
}

const adminApproveBySymbol = async (symbol: string) => {
  const rawInfos = REQUESTS.filter(req => req.symbol === symbol);
  if (rawInfos.length === 0) {
    console.log(`Not found in REQUESTS: ${symbol}`);
    return;
  }
  if (rawInfos.length > 1) {
    console.log(`Found multiple entries of the same symbol: ${symbol}`);
    return;
  }

  const info = rawInfos[0];
  await approveCoin(info, false);
}

program
  .command("approve-symbol")
  .description("")
  .argument('<TYPE_CoinType>')
  .action(adminApproveBySymbol);

const adminApproveAll = async () => {
  for (const info of REQUESTS) {
    await approveCoin(info, false);
    console.log("")
  }
}

program
    .command("approve-all")
    .description("")
    .action(adminApproveAll);

const adminUpdateBySymbol = async (symbol: string) => {
  const rawInfos = REQUESTS.filter(req => req.symbol === symbol);
  if (rawInfos.length === 0) {
    console.log(`Not found in REQUESTS: ${symbol}`);
    return;
  }
  if (rawInfos.length > 1) {
    console.log(`Found multiple entries of the same symbol: ${symbol}`);
    return;
  }

  const info = rawInfos[0];
  await approveCoin(info, true);
}

program
  .command("update-symbol")
  .description("")
  .argument('<TYPE_CoinType>')
  .action(adminUpdateBySymbol);

const adminUpdateAll = async () => {
  for (const info of REQUESTS) {
    await approveCoin(info, true);
    console.log("")
  }
}

program
    .command("update-all")
    .description("")
    .action(adminUpdateAll);

const removeCoin = async(info: RawCoinInfo) => {
  const {client, account} = readConfig(program);
  const CoinType = parseTypeTagOrThrow(info.token_type.type);

  const app = new App(client).coin_list.coin_list;
  let res = await app.remove_from_list(
      account,
      [CoinType])
  consoleTransactionResult("Remove from list", info, res)
  res = await app.remove_from_registry_by_approver(account, [CoinType])
  consoleTransactionResult("Remove from registry", info, res)
}

const adminRemoveBySymbol = async (symbol: string) => {
  const rawInfos = REQUESTS.filter(req => req.symbol === symbol);
  if (rawInfos.length === 0) {
    console.log(`Not found in REQUESTS: ${symbol}`);
    return;
  }
  if (rawInfos.length > 1) {
    console.log(`Found multiple entries of the same symbol: ${symbol}`);
    return;
  }

  const info = rawInfos[0];
  await removeCoin(info);
}

program
    .command("remove-symbol")
    .description("")
    .argument('<TYPE_CoinType>')
    .action(adminRemoveBySymbol);

const adminRemoveAll = async () => {
  for (const info of REQUESTS) {
    await removeCoin(info);
    console.log("")
  }
}

program
    .command("remove-all")
    .description("")
    .action(adminRemoveAll);

program.parse();
