"use client";

import dynamic from "next/dynamic";
import type { MerchBuyButtonProps } from "./MerchBuyButton.client";

const MerchBuyButton = dynamic<MerchBuyButtonProps>(
  () => import("./MerchBuyButton.client"),
  { ssr: false }
);

const SHOPIFY_BUY_BUTTON_EMBED = `
<div id='collection-component-17660470797127'></div>
<script type="text/javascript">
/*<![CDATA[*/
(function () {
  var scriptURL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
  if (window.ShopifyBuy) {
    if (window.ShopifyBuy.UI) {
      ShopifyBuyInit();
    } else {
      loadScript();
    }
  } else {
    loadScript();
  }
  function loadScript() {
    var script = document.createElement('script');
    script.async = true;
    script.src = scriptURL;
    (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(script);
    script.onload = ShopifyBuyInit;
  }
  function ShopifyBuyInit() {
    var client = ShopifyBuy.buildClient({
      domain: 'ta1hvq-tg.myshopify.com',
      storefrontAccessToken: '70d8fb236ce34c88adc6be10131bc7f',
    });
    ShopifyBuy.UI.onReady(client).then(function (ui) {
      ui.createComponent('collection', {
        id: '507484012833',
        node: document.getElementById('collection-component-17660470797127'),
        moneyFormat: '%24%7B%7Bamount%7D%7D',
        options: {}
      });
    });
  }
})();
/*]]>*/
</script>
`;

export default function MerchPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">4th Line Merch</h1>
      <p className="mt-2 text-slate-300">
        Live products from our Shopify store. Ships via Gelato.
      </p>

      <div className="mt-8 min-h-[220px] rounded-xl border border-slate-800 bg-slate-950 p-6">
        <MerchBuyButton embedHtml={SHOPIFY_BUY_BUTTON_EMBED} />
      </div>
    </main>
  );
}
