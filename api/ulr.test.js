var torrent = "magnet:?xt=urn:btih:ba8106fcca5108880f4a0182b37cfe0a693a6dd6&dn=Batman.The.Dark.Knight.2008.VF.XViD-Ox%0A%F0%9F%91%A4%205%20%F0%9F%92%BE%20699.5726%20MB%20%E2%9A%99%EF%B8%8F%20Torrent9%0A%F0%9F%87%AB%F0%9F%87%B7";

if (torrent.match(/magnet:\?xt=urn:[a-z0-9]+:[a-z0-9]{32}/i) !== null)
{
    console.log("It's valid, bloody fantastic!");
}