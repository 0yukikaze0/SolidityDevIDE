var web3;
var eth;
var shh;
var bzz;
var contract;
var blockSubscription;

var events = {};
var coinbase;
var params;

function init(){
    $('#statusDisplay').text('Disconnected!');
    $('#server').focus();
    $("#source").bind('paste',null, function(){
        setTimeout(parseSource,100)
    });
    $('#connectionType').change(renderConnectionParams);
    renderConnectionParams();
}

function renderConnectionParams(){
    let connectionType = $('#connectionType').val();
    let markup;
    if(connectionType === 'hostport'){
        markup = `
            <input type="text" placeholder="Server url/ip" id="server"/>
            <input type="text" placeholder="Port" id="port" />
            <button type="button" id="connectButton" onclick="connect()">Connect</button>
        `;
    } else if (connectionType === 'url') {
        markup = `
            <input type="text" placeholder="Node URL" id="nodeUrl" style="width:300px;"/>
            <button type="button" id="connectButton" onclick="connect()">Connect</button>
        `;
    }
    $('#connectionParams').html(markup);
}

function connect(){
    let connectionType = $('#connectionType').val();
    let protocol = $('#connectionProtocol').val();
    if(connectionType === 'hostport') {
        let url = protocol + '://' + $('#server').val() + ':' + $('#port').val();
        web3 = new Web3(new Web3.providers.WebsocketProvider(url))
        eth = web3.eth;
        shh = web3.shh;
        bzz = web3.bzz;
    } else if(connectionType === 'url') {
        let url = protocol + '://' + $('#nodeUrl').val() + '/';
        web3 = new Web3(new Web3.providers.WebsocketProvider(url))
        eth = web3.eth;
        shh = web3.shh;
        bzz = web3.bzz;
    }


    web3.eth.getBlockNumber()
        .then((blockNumber) => {
            $('#statusDisplay').html('Connected || Current Block : <span id="blockNumber">' + blockNumber + '</span');

            console.log('Subscribing to block events');
            blockSubscription = web3.eth.subscribe('newBlockHeaders', function(error, result){
            
                    console.log(result);
            })
            .on("data", function(blockHeader){
                console.log(blockHeader);
                $('#blockNumber').text(blockHeader.number);
            });

            web3.eth.getAccounts()
                .then((accounts) => {
                    coinbase = accounts[0];
                    params =  {
                        from : coinbase,
                        gas : 1000000
                    }
                    $('#coinbaseDisplay').text(coinbase);
                })
        })
}

var eventsCatalog = [];
var abi;
var bytecode;
function parseSource(){
    try{
        let source = JSON.parse($('#source').val());
        abi = JSON.parse(source.abi);
        bytecode = source.bytecode;
        $('#abi').val(source.abi);
        $('#bytecode').val(bytecode);
        contract = new eth.Contract(abi);
        
        for(let key in contract.events) {
            if(key.indexOf('(') < 0 && key.indexOf('0x') < 0 && key !== 'allEvents'){
                eventsCatalog.push(key);
            }
        }

        $('#eventsCatalog').html('')
        for(let index in eventsCatalog) {
            $('#eventsCatalog').append(`<div class="eventCard" id="${eventsCatalog[index]}">
                <div style="float:left; margin: 5px 0px 5px 10px">
                    ${eventsCatalog[index]}
                    <span class="subscriptionStatus">Not subscribed</span>
                </div>
                <div class="eventDetails">
                    <table>
                        <tbody>
                            <tr>
                                <td><button class="pastEventsButton" type="button" onclick="getPastEvents('${eventsCatalog[index]}')">Get Past Events</button></td>
                                <td style="padding: 5px;">Events Recorded</td>
                                <td style="padding: 5px;"><span class="eventCount">0</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>`)
        }
    }catch(e){
        console.log(e)
        $('#abi').val('Failed to parse source');
        $('#bytecode').val('Failed to parse source');    
    }
}

function deploy(){
    console.log('Contract Deployment');
    contract.deploy({ data: '0x' + bytecode }).send(
        {
            from: coinbase,
            gas: 5000000			     
        }
    )
    .on('error', function(error){console.log('error')})
    .on('transactionHash', function(transactionHash){
        console.log(`   +- Transaction hash : ${transactionHash}`);
        console.log(`   +- Waiting to be mined`);
        setTimeout(function(){
            eth.getTransactionReceipt(transactionHash)
                .then(function(receipt){
                    console.log(`   +- Contract address : ${receipt.contractAddress}`);
                    $('#contractAddress').val(receipt.contractAddress);
                    latch();
                })
        },2000)
    })

}

var hook;

function latch(){
    contract = new eth.Contract(abi, $('#contractAddress').val());
    hook = contract.methods;
    console.log(`   +- Hook latched`);

    subscribeEvents();
}

var eventCache = {}
function subscribeEvents(){
    for(let index in eventsCatalog) {
        let eventName = eventsCatalog[index];
        console.log(`   +- Subscribing to event [${eventName}]`);
        contract.events[eventName]()
            .on('data', function(event) {
                let eventName = event.event;
                if(eventCache[eventName] === undefined) {
                    eventCache[eventName] = [];
                }
                eventCache[eventName].push(event);
                $(`#${eventName} .eventCount`).text(eventCache[eventName].length);
            })
        $(`#${eventName} .subscriptionStatus`).text('Subscribed');
        $(`#${eventName} .pastEventsButton`).show();
    }
}

function toHex(input){
	return web3.utils.asciiToHex(input).padEnd(66,0);	
}

var pastEvents = {};
function getPastEvents(eventType){
    contract.getPastEvents(eventType,{fromBlock:0,toBlock:'latest'})
        .then(function(result){
            console.log(`Found ${result.length} past events of type ${eventType}`);
            console.log(`   +- pastEvents.${eventType}`)
            pastEvents[eventType] = result;
        });
}