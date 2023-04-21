$scriptPath = split-path -parent $MyInvocation.MyCommand.Definition

$nodePath=$args[0]
$token=$args[1]

$command="$nodePath $scriptPath/../src/client.js --offer-token $token; sleep 5"

echo $command; sleep 5

cmd /c start powershell -Command "$command"
