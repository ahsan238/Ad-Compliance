import logging
from adblockparser import AdblockRules
from bs4 import BeautifulSoup
from mitmproxy import http
import json
import sqlite3
import sys
from mitmproxy import ctx

allowed_domain = "https://whatisthis.com"

class AdParser:
    def __init__(self):
        self.debug = False
        self.count = 1
        self.logger = logging.getLogger("request_logger")
        self.logger.setLevel(logging.INFO)
        formatter = logging.Formatter('%(asctime)s - %(message)s', '%Y-%m-%d %H:%M:%S')
        
        # clear the proxy.log file by opening it in write mode
        fp = open("proxy.log", "w")
        fp.close()

        # Log to a file
        file_handler = logging.FileHandler("proxy.log")
        file_handler.setFormatter(formatter)
        self.logger.addHandler(file_handler)

    def load(self, loader):
        loader.add_option(
            name = "website",
            typespec = str,
            default = "https://www.google.com",
            help = "Website to be crawled"
        )

        loader.add_option(
            name = "db_name",
            typespec = str,
            default = "test.db",
            help = "Database name to store logs"
        )

        assert any('website' in argv for argv in sys.argv), "Website not provided"
        assert any('db_name' in argv for argv in sys.argv), "DB name not provided"


    def configure(self, updates):
        options = ctx.options
        self.url = options.website
        self.db_name = options.db_name

        # Store the scripts as strings in the proxy

        # TODO: Probably take these too from the command line.
        with open("./injectionScripts/xpathsOfElems.js", "r") as injectJS:
            self.injectScript = injectJS.read()

        self.log_db = sqlite3.connect(self.db_name)

        # create tables with schema
        # TODO: Probably take this information from command line.
        with open("./db.schema", "r") as dbschema:
            schema = dbschema.read()
            self.log_db.executescript(schema)

    def response(self,flow):
        # Check if the flow url is in self.url
        isPrimaryDomain = self.url in flow.request.pretty_url or True
        if 'text/html' in flow.response.headers.get("content-type", '') and isPrimaryDomain:
            html = BeautifulSoup(flow.response.content, "html.parser")
            script = html.new_tag("script", nonce='wspradcompliance23cosmeticfilter', defer='')
            script.string = self.injectScript.replace('SCRIPTID_ARBITRARY', str(self.count))

            if html.head:
                html.head.insert(0, script)
            else:
                head = html.new_tag("head")
                html.insert(0, head)
                html.head.insert(0, script)

            self.count += 1 
            flow.response.content = html.encode('utf-8')
        
        # logging the request url
        # self.logger.info(f"Request URL: {flow.request.pretty_url}")

    def _isSkippedUrl(self, flow):
        return '250.250.250.250' == flow.request.host or 'non-exist-api' in flow.request.path

    def request(self, flow):
        
        # Drop the request if the url contains 'getadblock.com'
        if 'getadblock.com' in flow.request.pretty_url:
            self.logger.info(f"Request to getadblock.com: {flow.request.pretty_url}")
            flow.kill()
            return
        if self._isSkippedUrl(flow):
            flow.response = http.Response.make(200, b'ACK', {})
            # self.logger.info('Skipping url')

        if 'whatisthis' in flow.request.pretty_host:
            # self.logger.info(f"Logged the request from script id: {flow.request.path}")
            self.log_db.execute("INSERT INTO ids (id1, id2) VALUES (?, ?)",
                                (flow.request.path, flow.request.content))
            self.log_db.commit()
            # Send a dummy response back.
            flow.response = http.Response.make(200, b'ACK', {})



addons = [AdParser()]
        
