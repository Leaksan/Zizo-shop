$ErrorActionPreference = "Stop"
$base = "http://localhost:5000/api"
$admin = $null
$courierSess = $null

function Test-Step($name, $block) {
    try {
        & $block
        Write-Host "[OK] $name"
    } catch {
        Write-Host "[FAIL] $name : $($_.Exception.Message)"
        exit 1
    }
}

Test-Step "Catalogue : 16 produits seedes avec variantes" {
    $r = Invoke-RestMethod "$base/products"
    if ($r.Count -ne 16) { throw "16 attendus, $($r.Count) recus" }
    $tshirt = $r | Where-Object { $_.name -eq "T-Shirt Coton Bio" }
    if ($tshirt.variants.Count -ne 6) { throw "variantes tshirt incorrectes" }
    if ($tshirt.price_min -ne 9800 -or $tshirt.price_max -ne 11100) { throw "prix min/max incorrects: $($tshirt.price_min)-$($tshirt.price_max)" }
    $ecouteurs = $r | Where-Object { $_.name -like "*couteurs*" }
    if ($ecouteurs.promo_percent -ne 25) { throw "promo_percent incorrect: $($ecouteurs.promo_percent)" }
    if ($ecouteurs.badge -ne "Promo" -or $ecouteurs.rating -ne 4.5) { throw "badge/rating incorrects" }
}

Test-Step "Settings publics : zones Libreville + frais + tel (FCFA)" {
    $r = Invoke-RestMethod "$base/settings/public"
    if ($r.zones.Count -lt 10) { throw "zones Libreville incorrectes: $($r.zones.Count)" }
    if ($r.zones -notcontains "Glass") { throw "quartier Glass manquant" }
    if ($r.currency -ne "XOF") { throw "devise incorrecte: $($r.currency)" }
    if ($r.delivery_fee -ne 2000 -or $r.free_shipping_threshold -ne 30000) { throw "frais incorrects" }
    if ($r.shop_phone -ne "074756768") { throw "telephone incorrect: $($r.shop_phone)" }
}

Test-Step "Promo : validation code actif" {
    $r = Invoke-RestMethod -Method Post "$base/promo/validate" -ContentType "application/json; charset=utf-8" -Body '{"code":"bienvenue10"}'
    if ($r.type -ne "percent" -or $r.value -ne 10) { throw "promo incorrecte" }
}

Test-Step "Promo : code invalide refuse" {
    try {
        Invoke-RestMethod -Method Post "$base/promo/validate" -ContentType "application/json; charset=utf-8" -Body '{"code":"FAUX"}'
        throw "code accepte"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw $_ }
    }
}

$script:variantId = 0
$script:orderRef = ""
$script:orderId = 0

Test-Step "Commande avec promo -10% + frais livraison (FCFA)" {
    $p = Invoke-RestMethod "$base/products"
    $cafe = ($p | Where-Object { $_.name -like "Caf* Arabica" }).variants | Where-Object { $_.name -eq "250 g" }
    $script:variantId = $cafe.id
    $body = @{
        customer_name = "Jean Test"
        customer_phone = "0611223344"
        customer_address = "5 avenue du Test"
        zone = "Glass"
        note = "Sonner 2 fois"
        payment_method = "livraison"
        promo_code = "BIENVENUE10"
        latitude = 0.4067
        longitude = 9.4608
        items = @(@{ variant_id = $cafe.id; quantity = 2 })
    } | ConvertTo-Json
    $o = Invoke-RestMethod -Method Post "$base/orders" -ContentType "application/json; charset=utf-8" -Body $body
    $script:orderRef = $o.reference
    $script:orderId = $o.id
    if ($o.subtotal -ne 11800) { throw "subtotal: $($o.subtotal)" }
    if ($o.discount -ne 1180) { throw "discount: $($o.discount)" }
    if ($o.delivery_fee -ne 2000) { throw "delivery_fee: $($o.delivery_fee)" }
    if ($o.total -ne 12620) { throw "total: $($o.total)" }
    if ($o.reference -notmatch "^CMD-") { throw "reference invalide" }
}

Test-Step "Commande avec livraison offerte (seuil 30000 FCFA)" {
    $p = Invoke-RestMethod "$base/products"
    $tel = $p | ForEach-Object { $_.variants } | Where-Object { $_.price -ge 30000 -and $_.stock -gt 0 } | Select-Object -First 1
    if (-not $tel) { throw "aucune variante chere en stock pour le test" }
    $body = @{
        customer_name = "Jean Test"
        customer_phone = "0611223344"
        customer_address = "5 avenue du Test"
        zone = "Akébé"
        payment_method = "carte"
        items = @(@{ variant_id = $tel.id; quantity = 1 })
    } | ConvertTo-Json
    $o = Invoke-RestMethod -Method Post "$base/orders" -ContentType "application/json; charset=utf-8" -Body $body
    if ($o.delivery_fee -ne 0) { throw "livraison devrait etre offerte" }
    if ($o.total -ne $tel.price) { throw "total: $($o.total) attendu $($tel.price)" }
}

Test-Step "Commande refuse zone invalide" {
    $body = @{
        customer_name = "Jean Test"
        customer_phone = "0611223344"
        customer_address = "5 avenue du Test"
        zone = "Zone Inexistante"
        items = @(@{ variant_id = $script:variantId; quantity = 1 })
    } | ConvertTo-Json
    try {
        Invoke-RestMethod -Method Post "$base/orders" -ContentType "application/json; charset=utf-8" -Body $body
        throw "zone acceptee"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 400) { throw $_ }
    }
}

Test-Step "Suivi de commande public (avec GPS)" {
    $o = Invoke-RestMethod "$base/orders/track/$script:orderRef"
    if ($o.status -ne "pending" -or $o.customer_name -ne "Jean Test") { throw "suivi incorrect" }
    if ($o.latitude -ne 0.4067 -or $o.longitude -ne 9.4608) { throw "GPS non enregistre" }
}

Test-Step "Livreur : nettoyage puis inscription" {
    Invoke-RestMethod -Method Post "$base/admin/login" -ContentType "application/json; charset=utf-8" -Body '{"password":"admin123"}' -SessionVariable av | Out-Null
    $script:admin = $av
    $cs = Invoke-RestMethod "$base/admin/couriers" -WebSession $script:admin
    $old = $cs | Where-Object { $_.phone -eq "0700000001" }
    if ($old) {
        Invoke-RestMethod -Method Delete "$base/admin/couriers/$($old.id)" -WebSession $script:admin | Out-Null
    }
    $body = @{ name = "Test Livreur"; phone = "0700000001"; password = "test1234"; vehicle = "Velo"; zone = "Glass" } | ConvertTo-Json
    $c = Invoke-RestMethod -Method Post "$base/courier/register" -ContentType "application/json; charset=utf-8" -Body $body -SessionVariable cs
    $script:courierSess = $cs
    if ($c.name -ne "Test Livreur") { throw "inscription incorrecte" }
    if ($c.verified -ne $false) { throw "nouveau livreur devrait etre non verifie" }
}

Test-Step "Anti-fraude : livreur non verifie ne peut pas accepter" {
    try {
        Invoke-RestMethod -Method Post "$base/courier/deliveries/$script:orderId/accept" -WebSession $script:courierSess
        throw "acceptation autorisee sans verification"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 403) { throw $_ }
    }
}

Test-Step "Admin : login + verification du livreur" {
    Invoke-RestMethod -Method Post "$base/admin/login" -ContentType "application/json; charset=utf-8" -Body '{"password":"admin123"}' -SessionVariable av | Out-Null
    $script:admin = $av
    $cs = Invoke-RestMethod "$base/admin/couriers" -WebSession $script:admin
    $t = $cs | Where-Object { $_.phone -eq "0700000001" }
    Invoke-RestMethod -Method Put "$base/admin/couriers/$($t.id)" -ContentType "application/json; charset=utf-8" -Body '{"verified":true}' -WebSession $script:admin | Out-Null
}

Test-Step "Livreur : courses disponibles (zone preferee en premier)" {
    $d = Invoke-RestMethod "$base/courier/deliveries" -WebSession $script:courierSess
    if ($d.available.Count -lt 2) { throw "courses manquantes" }
    if ($d.available[0].zone -ne "Glass") { throw "tri par zone incorrect: $($d.available[0].zone)" }
    if ($d.commission -ne 2000) { throw "commission incorrecte" }
}

Test-Step "Livreur : accepter une course" {
    $d = Invoke-RestMethod "$base/courier/deliveries" -WebSession $script:courierSess
    $course = $d.available | Where-Object { $_.id -eq $script:orderId }
    if (-not $course) { throw "commande test non visible" }
    $o = Invoke-RestMethod -Method Post "$base/courier/deliveries/$script:orderId/accept" -WebSession $script:courierSess
    if ($o.status -ne "delivering") { throw "statut incorrect: $($o.status)" }
}

Test-Step "Suivi : livreur visible + code de livraison present" {
    $o = Invoke-RestMethod "$base/orders/track/$script:orderRef"
    if ($o.status -ne "delivering" -or -not $o.courier -or $o.courier.name -ne "Test Livreur") { throw "livreur non visible" }
    if ($o.delivery_code -notmatch "^\d{4}$") { throw "code de livraison absent: $($o.delivery_code)" }
    $script:deliveryCode = $o.delivery_code
}

Test-Step "Livreur : partage de position GPS" {
    Invoke-RestMethod -Method Put "$base/courier/position" -ContentType "application/json; charset=utf-8" -Body '{"lat":0.4162,"lng":9.4673}' -WebSession $script:courierSess | Out-Null
    $o = Invoke-RestMethod "$base/orders/track/$script:orderRef"
    if ($o.courier.lat -ne 0.4162 -or $o.courier.lng -ne 9.4673) { throw "position livreur non visible dans le suivi" }
}

Test-Step "Geocodage : endpoints repondent" {
    $s = Invoke-RestMethod "$base/geocode/search?q=Glass"
    if ($null -eq $s) { throw "search ne repond pas" }
    $r = Invoke-RestMethod "$base/geocode/reverse?lat=0.4162&lng=9.4673"
    if ($null -eq $r) { throw "reverse ne repond pas" }
    if ($s.Count -gt 0 -and (-not $s[0].lat -or -not $s[0].lng)) { throw "resultats geocodage sans coordonnees" }
}

Test-Step "Anti-fraude : terminer sans code refuse" {
    try {
        Invoke-RestMethod -Method Post "$base/courier/deliveries/$script:orderId/complete" -ContentType "application/json; charset=utf-8" -Body '{"code":"0000"}' -WebSession $script:courierSess
        throw "livraison confirmee sans bon code"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 400) { throw $_ }
    }
}

Test-Step "Livreur : terminer la course avec le code client" {
    $body = @{ code = $script:deliveryCode } | ConvertTo-Json
    $o = Invoke-RestMethod -Method Post "$base/courier/deliveries/$script:orderId/complete" -ContentType "application/json; charset=utf-8" -Body $body -WebSession $script:courierSess
    if ($o.status -ne "delivered") { throw "statut incorrect" }
    $d = Invoke-RestMethod "$base/courier/deliveries" -WebSession $script:courierSess
    if ($d.earnings -ne 2000) { throw "gains incorrects: $($d.earnings)" }
}

Test-Step "Client : note le livreur apres livraison" {
    $body = @{ rating = 5; comment = "Tres rapide !" } | ConvertTo-Json
    $o = Invoke-RestMethod -Method Put "$base/orders/$script:orderRef/courier-rating" -ContentType "application/json; charset=utf-8" -Body $body
    if ($o.courier_rating -ne 5) { throw "note non enregistree" }
    $d = Invoke-RestMethod "$base/courier/deliveries" -WebSession $script:courierSess
    if ($d.rating_avg -ne 5 -or $d.rating_count -ne 1) { throw "moyenne livreur incorrecte" }
}

Test-Step "Client : avis produit avec photo" {
    $png = [System.IO.Path]::Combine($env:TEMP, "avis.png")
    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap 300, 300
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::CornflowerBlue)
    $bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    $track = Invoke-RestMethod "$base/orders/track/$script:orderRef"
    $item = $track.items[0]
    curl.exe -s -X POST "$base/orders/$script:orderRef/reviews" -F "product_id=$($item.product_id)" -F "rating=4" -F "comment=Tres bon cafe" -F "photo=@$png;type=image/png" | Out-Null
    $reviews = Invoke-RestMethod "$base/products/$($item.product_id)/reviews"
    if ($reviews.Count -lt 1) { throw "avis non publie" }
    if (-not $reviews[0].photo_url) { throw "photo avis manquante" }
    $prod = Invoke-RestMethod "$base/products/$($item.product_id)"
    if ($prod.real_reviews_count -lt 1) { throw "avis non comptabilise" }
    if ($prod.real_rating -ne 4) { throw "real_rating incorrect: $($prod.real_rating)" }
    Remove-Item $png -ErrorAction SilentlyContinue
}

Test-Step "Retrait en boutique (pickup) : sans adresse ni frais" {
    $p = Invoke-RestMethod "$base/products"
    $v = $p | ForEach-Object { $_.variants } | Where-Object { $_.stock -gt 0 } | Select-Object -First 1
    $body = @{
        customer_name = "Client Pickup"
        customer_phone = "0655443322"
        delivery_method = "pickup"
        items = @(@{ variant_id = $v.id; quantity = 1 })
    } | ConvertTo-Json
    $o = Invoke-RestMethod -Method Post "$base/orders" -ContentType "application/json; charset=utf-8" -Body $body
    if ($o.delivery_method -ne "pickup" -or $o.delivery_fee -ne 0) { throw "pickup incorrect" }
    $script:pickupOrderId = $o.id
}

Test-Step "Pickup invisible pour les livreurs" {
    $d = Invoke-RestMethod "$base/courier/deliveries" -WebSession $script:courierSess
    if ($d.available | Where-Object { $_.id -eq $script:pickupOrderId }) { throw "pickup visible chez le livreur" }
}

Test-Step "Demande de reassort (rupture de stock)" {
    $p = Invoke-RestMethod "$base/products"
    $out = $p | ForEach-Object { $_.variants } | Where-Object { $_.stock -eq 0 } | Select-Object -First 1
    $restoredProduct = $null
    if (-not $out) {
        $v = $p | ForEach-Object { $_.variants } | Select-Object -First 1
        $prodId = $v.product_id
        $prod = Invoke-RestMethod "$base/products/$prodId"
        $vars = @($prod.variants | ForEach-Object { @{ id = $_.id; name = $_.name; price = $_.price; stock = 0 } })
        $bodyU = @{ variants = $vars } | ConvertTo-Json -Depth 3
        Invoke-RestMethod -Method Put "$base/admin/products/$prodId" -ContentType "application/json; charset=utf-8" -Body $bodyU -WebSession $script:admin | Out-Null
        $out = $v
        $restoredProduct = $prodId
    }
    try {
        $body = @{ variant_id = $out.id; phone = "0611111111" } | ConvertTo-Json
        Invoke-RestMethod -Method Post "$base/stock-requests" -ContentType "application/json; charset=utf-8" -Body $body | Out-Null
        $list = Invoke-RestMethod "$base/admin/stock-requests" -WebSession $script:admin
        if ($list.Count -lt 1 -or $list[0].count -lt 1) { throw "demande non visible admin" }
        Invoke-RestMethod -Method Post "$base/admin/stock-requests/clear-variant/$($out.id)" -WebSession $script:admin | Out-Null
    } finally {
        if ($restoredProduct) {
            $prod2 = Invoke-RestMethod "$base/products/$restoredProduct"
            $vars2 = @($prod2.variants | ForEach-Object { @{ id = $_.id; name = $_.name; price = $_.price; stock = 10 } })
            $bodyR = @{ variants = $vars2 } | ConvertTo-Json -Depth 3
            Invoke-RestMethod -Method Put "$base/admin/products/$restoredProduct" -ContentType "application/json; charset=utf-8" -Body $bodyR -WebSession $script:admin | Out-Null
        }
    }
}

Test-Step "Offre du jour" {
    $d = Invoke-RestMethod "$base/deal"
    if (-not $d.id -or -not $d.variants) { throw "offre du jour invalide" }
}

Test-Step "Admin : stats enrichies" {
    $s = Invoke-RestMethod "$base/admin/stats" -WebSession $script:admin
    if ($s.total_couriers -lt 2) { throw "livreurs manquants" }
    if ($s.revenue -le 0) { throw "revenue incorrect" }
}

Test-Step "Admin : promos CRUD" {
    $p = Invoke-RestMethod -Method Post "$base/admin/promos" -ContentType "application/json; charset=utf-8" -Body '{"code":"TEST20","type":"percent","value":20,"label":"-20 %"}' -WebSession $script:admin
    $p2 = Invoke-RestMethod -Method Put "$base/admin/promos/$($p.id)" -ContentType "application/json; charset=utf-8" -Body '{"active":false}' -WebSession $script:admin
    if ($p2.active -ne $false) { throw "toggle incorrect" }
    try {
        Invoke-RestMethod -Method Post "$base/promo/validate" -ContentType "application/json; charset=utf-8" -Body '{"code":"TEST20"}'
        throw "promo inactive encore valide"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw $_ }
    }
    Invoke-RestMethod -Method Delete "$base/admin/promos/$($p.id)" -WebSession $script:admin | Out-Null
}

Test-Step "Admin : liste livreurs avec gains" {
    $cs = Invoke-RestMethod "$base/admin/couriers" -WebSession $script:admin
    $t = $cs | Where-Object { $_.phone -eq "0700000001" }
    if (-not $t -or $t.delivered_count -ne 1 -or $t.earnings -ne 2000) { throw "stats livreur incorrectes" }
    if ($t.rating_avg -ne 5) { throw "note livreur non visible admin" }
}

Test-Step "Admin : prime au meilleur livreur" {
    $cs = Invoke-RestMethod "$base/admin/couriers" -WebSession $script:admin
    $t = $cs | Where-Object { $_.phone -eq "0700000001" }
    Invoke-RestMethod -Method Put "$base/admin/couriers/$($t.id)" -ContentType "application/json; charset=utf-8" -Body '{"bonus_add":5000}' -WebSession $script:admin | Out-Null
    $cs2 = Invoke-RestMethod "$base/admin/couriers" -WebSession $script:admin
    $t2 = $cs2 | Where-Object { $_.phone -eq "0700000001" }
    if ($t2.bonus_total -ne 5000 -or $t2.earnings -ne 7000) { throw "prime incorrecte: $($t2.bonus_total) / $($t2.earnings)" }
    $d = Invoke-RestMethod "$base/courier/deliveries" -WebSession $script:courierSess
    if ($d.bonus_total -ne 5000 -or $d.earnings -ne 7000) { throw "prime non visible cote livreur" }
}

Test-Step "Admin : settings livraison + zones" {
    $before = Invoke-RestMethod "$base/settings/public"
    $body = @{ delivery_fee = "2500"; zones = @("Centre", "Banlieue") } | ConvertTo-Json
    Invoke-RestMethod -Method Put "$base/admin/settings" -ContentType "application/json; charset=utf-8" -Body $body -WebSession $script:admin | Out-Null
    $s = Invoke-RestMethod "$base/settings/public"
    if ($s.delivery_fee -ne 2500 -or $s.zones.Count -ne 2) { throw "settings non persistes" }
    $restore = @{ delivery_fee = "2000"; zones = $before.zones } | ConvertTo-Json
    Invoke-RestMethod -Method Put "$base/admin/settings" -ContentType "application/json; charset=utf-8" -Body $restore -WebSession $script:admin | Out-Null
}

Test-Step "Liquidation : creation produit + visibilite publique" {
    $body = @{
        name = "Produit Liquidation E2E"
        clearance = $true
        variants = @(@{ name = "Standard"; price = 1000; old_price = 5000; stock = 3 })
    } | ConvertTo-Json -Depth 3
    $p = Invoke-RestMethod -Method Post "$base/admin/products" -ContentType "application/json; charset=utf-8" -Body $body -WebSession $script:admin
    if ($p.clearance -ne $true) { throw "flag liquidation non enregistre" }
    if ($p.promo_percent -ne 80) { throw "promo_percent: $($p.promo_percent)" }
    $pub = Invoke-RestMethod "$base/products/$($p.id)"
    if ($pub.clearance -ne $true) { throw "liquidation non visible publiquement" }
    $body2 = @{ clearance = $false } | ConvertTo-Json
    $p2 = Invoke-RestMethod -Method Put "$base/admin/products/$($p.id)" -ContentType "application/json; charset=utf-8" -Body $body2 -WebSession $script:admin
    if ($p2.clearance -ne $false) { throw "toggle liquidation ko" }
    Invoke-RestMethod -Method Delete "$base/admin/products/$($p.id)" -WebSession $script:admin | Out-Null
}

Test-Step "Admin : suppression livreur test" {
    $cs = Invoke-RestMethod "$base/admin/couriers" -WebSession $script:admin
    $t = $cs | Where-Object { $_.phone -eq "0700000001" }
    Invoke-RestMethod -Method Delete "$base/admin/couriers/$($t.id)" -WebSession $script:admin | Out-Null
}

Test-Step "Admin : upload d'image (resize + service)" {
    $png = [System.IO.Path]::Combine($env:TEMP, "test-upload.png")
    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap 1200, 800
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Tomato)
    $bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    $cookieJar = [System.IO.Path]::Combine($env:TEMP, "admin-cookies.txt")
    curl.exe -s -c $cookieJar -X POST "$base/admin/login" -H "Content-Type: application/json" -d '{\"password\":\"admin123\"}' | Out-Null
    $resp = curl.exe -s -b $cookieJar -X POST "$base/admin/upload" -F "file=@$png;type=image/png" | ConvertFrom-Json
    if (-not $resp.url -or $resp.url -notlike "/uploads/*") { throw "url incorrecte: $($resp.url)" }
    $img = Invoke-WebRequest "http://localhost:5000$($resp.url)" -UseBasicParsing
    if ($img.StatusCode -ne 200 -or $img.Content.Length -eq 0) { throw "image non servie" }
    Add-Type -AssemblyName System.Drawing
    $ms = New-Object System.IO.MemoryStream(,$img.Content)
    $uploaded = [System.Drawing.Image]::FromStream($ms)
    if ($uploaded.Width -gt 900 -or $uploaded.Height -gt 900) { throw "non redimensionnee: $($uploaded.Width)x$($uploaded.Height)" }
    $uploaded.Dispose(); $ms.Dispose()
    Remove-Item $png, $cookieJar -ErrorAction SilentlyContinue
}

Write-Host "`nTous les tests E2E passent."

