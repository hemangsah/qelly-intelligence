param(
    [Parameter(Mandatory = $true)][string]$Sitemap,
    [Parameter(Mandatory = $true)][string]$Schema,
    [Parameter(Mandatory = $true)][int]$ExpectedErrors,
    [Parameter(Mandatory = $true)][string]$Output
)
$ErrorActionPreference = 'Stop'
$sitemapSchemaSet = [System.Xml.Schema.XmlSchemaSet]::new()
$sitemapSchemaSet.XmlResolver = $null
$sitemapSchemaReader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new([System.IO.File]::ReadAllText($Schema)))
$null = $sitemapSchemaSet.Add('http://www.sitemaps.org/schemas/sitemap/0.9', $sitemapSchemaReader)
$sitemapSchemaSet.Compile()
$sitemapSchemaReader.Close()
$sitemapMessages = [System.Collections.Generic.List[object]]::new()
$sitemapSettings = [System.Xml.XmlReaderSettings]::new()
$sitemapSettings.Schemas = $sitemapSchemaSet
$sitemapSettings.ValidationType = [System.Xml.ValidationType]::Schema
$sitemapSettings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$sitemapSettings.XmlResolver = $null
$sitemapSettings.add_ValidationEventHandler([System.Xml.Schema.ValidationEventHandler] {
    param($sitemapSender, $sitemapEvent)
    $sitemapMessages.Add([PSCustomObject]@{ severity = $sitemapEvent.Severity.ToString(); message = $sitemapEvent.Message })
})
$sitemapReader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new([System.IO.File]::ReadAllText($Sitemap)), $sitemapSettings)
while ($sitemapReader.Read()) {}
$sitemapReader.Close()
if ($sitemapMessages.Count -ne $ExpectedErrors) { throw "Expected $ExpectedErrors schema errors; observed $($sitemapMessages.Count)" }
foreach ($sitemapMessage in $sitemapMessages) {
    if ($sitemapMessage.severity -ne 'Error' -or $sitemapMessage.message -notmatch "cannot contain text") { throw 'Unexpected schema rejection' }
}
$sitemapResult = [PSCustomObject]@{ schemaCompiled = $true; externalResolverDisabled = $true; expectedErrors = $ExpectedErrors; actualErrors = $sitemapMessages.Count; valid = $sitemapMessages.Count -eq 0; errors = @($sitemapMessages.ToArray()) }
[System.IO.File]::WriteAllText($Output, ($sitemapResult | ConvertTo-Json -Depth 20) + "`n", [System.Text.UTF8Encoding]::new($false))
