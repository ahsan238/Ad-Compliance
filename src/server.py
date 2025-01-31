import os
import sys
import signal
import json
import socket
import subprocess, time, signal
import multiprocessing
import threading
from _thread import *
import asyncio

from mitmproxy.io import FlowReader


ignoreIfWebsiteCrawled = False

INJECTORFILE = '/home/azafar2/AdCompliance/src/injector-abp.py'
BASEPATH = "/home/azafar2/AdCompliance/"
DBSAVEPATH = "/home/azafar2/AdCompliance/data_modified/"
host = 'localhost'

def activateProxy(website, portNum):
    # print('Activating proxy')
    # print(f"mitmdump --listen-port {portNum} -s {INJECTORFILE} --set website={website} --set db_name={DBSAVEPATH}{website}.db -w {BASEPATH}dump/{website} > /dev/null &")
    os.system(f"mitmdump --listen-port {portNum} -s {INJECTORFILE} --set website={website} --set db_name={DBSAVEPATH}{website.replace('/','__')}.db -w {BASEPATH}dump/{website.replace('/','__')} > /dev/null &")
    # print(f"mitmdump -s {INJECTORFILE} --set website={website} --set db_name={DBSAVEPATH}test.db -w {BASEPATH}dump/test > /dev/null &")
    # os.system(f"mitmdump -s {INJECTORFILE} --set website={website} --set db_name={DBSAVEPATH}test.db -w {BASEPATH}dump/test > /dev/null &")
    
def removeWebsiteDumpFile(website):
    if os.path.exists(f"{BASEPATH}/data_modified/{website}.db"):
        os.remove(f"{BASEPATH}/data_modified/{website}.db")

def deactivateProxy(instance_port):
    r = subprocess.Popen("kill -9 $(lsof -ti:{})".format(instance_port), shell =True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = r.communicate()

def isPortActive(instance_port):
    r = subprocess.Popen(f"ss -plnt | grep {instance_port}".format(instance_port), shell =True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = r.communicate()
    for l in out.splitlines():
        if str(instance_port) in l.decode():
            # print('Port is active')
            return True
    return False


def launchCrawl(website, adblockFlag=0, portNum=8080):
    if isPortActive(portNum):
        # print('deactivating proxy')
        deactivateProxy(portNum)
    removeWebsiteDumpFile(website)
    activateProxy(website, portNum)
    time.sleep(5)
    if not isPortActive(portNum):
        # print("Proxy not activated")
        return -1
    time.sleep(5)

    # Run automatedCrawl.js using node as a subprocess
    # First crawl will be without adblock and the second will be with the adblock
    """
    Flag 0 -no adblock
    Flag 1 -adblock with acceptable ads
    Flag 2 -adblock without acceptable ads
    """
    if adblockFlag == 0:
        r = subprocess.Popen(f"node {BASEPATH}/puppeteer/automatedCrawl.js {website} 0 {portNum}", shell =True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    elif adblockFlag == 1:
        r = subprocess.Popen(f"node {BASEPATH}/puppeteer/automatedCrawl.js {website} 1 {portNum}", shell =True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    elif adblockFlag == 2:
        r = subprocess.Popen(f"node {BASEPATH}/puppeteer/automatedCrawl.js {website} 2 {portNum}", shell =True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = r.communicate()
    print(out)
    
    # Wait for the process to finish
    r.wait()
    time.sleep(3)

    # Deactivate the proxy
    deactivateProxy(portNum)
    return 1


def readURLS(filepath='websites.txt'):
    with open(filepath, mode='r') as f:
        websites = f.readlines()
    websites = [x.strip() for x in websites]
    return websites


def cleanup(portNum=50001):
    if isPortActive(portNum):
        deactivateProxy(portNum)
    # remove all the files in DBSAVEPATH
    for file in os.listdir(DBSAVEPATH):
        if file.endswith(".db"):
            os.remove(os.path.join(DBSAVEPATH, file))

def logFailedWebsites(website):
    with open("failedWebsites.txt", "a") as f:
        f.write(website + "\n")
        
def activateProxyTest(portNum):
    if isPortActive(portNum):
        # print('deactivating proxy')
        deactivateProxy(portNum)
    removeWebsiteDumpFile('dawn.com')
    activateProxy('dawn.com')

def ignoreWebsitesAlreadyVisited(websiteList):
    # check if the website has already been visited
    for website in websiteList:
        if os.path.exists(DBSAVEPATH + website + ".db"):
            websiteList.remove(website)
    return websiteList

def organizeLogFiles(website,adblockFlag=0, test=False):
    if test:
        # move the log file to its namesake folder in DBSAVEPATH
        if os.path.exists(f"{DBSAVEPATH}test.db"):
            # first check if the namesake folder exists and then move the file to the folder
            if not os.path.exists(f"{DBSAVEPATH}test"):
                os.makedirs(f"{DBSAVEPATH}test")
            # move the file to the folder
            if adblockFlag == 1:
                os.rename(f"{DBSAVEPATH}test.db", f"{DBSAVEPATH}test/adblock_test.db")
            elif adblockFlag == 2:
                os.rename(f"{DBSAVEPATH}test.db", f"{DBSAVEPATH}test/adblock_no_acceptable_ads_test.db")
            else:
                os.rename(f"{DBSAVEPATH}test.db", f"{DBSAVEPATH}test/test.db")
        return
    # move the log file to its namesake folder in DBSAVEPATH
    if os.path.exists(f"{DBSAVEPATH}{website}.db"):
        # first check if the namesake folder exists and then move the file to the folder
        if not os.path.exists(f"{DBSAVEPATH}{website}"):
            os.makedirs(f"{DBSAVEPATH}{website}")
        # move the file to the folder
        if adblockFlag == 1:
            os.rename(f"{DBSAVEPATH}{website}.db", f"{DBSAVEPATH}{website}/adblock_{website}.db")
        elif adblockFlag == 2:
            os.rename(f"{DBSAVEPATH}{website}.db", f"{DBSAVEPATH}{website}/adblock_no_acceptable_ads_{website}.db")
        else:
            os.rename(f"{DBSAVEPATH}{website}.db", f"{DBSAVEPATH}{website}/{website}.db")

def crawl(websites, portNum, isTest=False, firstEnv=1, secondEnv=2):
    # at some point, need to refactor this configuration to be more dynamic
    envConfig = {
        0: 'no adblock',
        1: 'adblock with acceptable ads',
        2: 'adblock without acceptable ads'
    }
    # if websites is a string, add it to a list
    if type(websites) == str:
        websites = [websites]
    
    
    
    for website in websites:
        print(f"Running crawl for {website} on setting {envConfig[firstEnv]} with port {portNum}")
        res = launchCrawl(website, firstEnv, portNum)
        if res == 1:
            organizeLogFiles(website, firstEnv, isTest)

        print(f"Running crawl for {website} on setting {envConfig[secondEnv]} with port {portNum}")
        res = launchCrawl(website, secondEnv, portNum)
        if res == 1:
            organizeLogFiles(website, secondEnv, isTest)

def get_violated_domains():
    domains = []
    filepath = '/home/azafar2/AdCompliance/postprocessor/domain_violated_rank.json'
    with open(filepath) as fp:
        d = json.load(fp)
        domains = list(d.keys())
    return domains

def crawlSetup():
    websiteListFile = 'websites.txt'
    websiteListFile = '/home/azafar2/AdCompliance/postprocessor/trancoDomainsThatAreIncludedInException.txt'
    websites = readURLS(websiteListFile)
    excludedWebsites = testfn()
    websites = [x for x in websites if x not in excludedWebsites]
    print(len(websites))
    websites = get_violated_domains() # for recrawling the domains where non-compliant ads were found
    # return
    # print(websites[:22])
    # return 

    # test with first 50 websites
    # websites = websites[:50]
    # websites = ['microsoft.com', 'apple.com']
    # create two sets of portNums for the two halves of the websites
    """
    Given there is a number n that is the number of processes that be run in parallel, we can divide the websites into n parts and run the processes in parallel. We also want n different port numbers starting from 50001 and incrementing by 1 for each process.
    """
    # websites = websites[:25]
    # websites = readURLS('domainsToTest/adFormsDomain.txt')
    # websites = ['pause-sport.com', 'republicworld.com', 'starbounder.org', 'culturequizz.com']
    # websites += ['msn.com', 'warcraftlogs.com', 'deadline.com', 'cnn.com', 'wordplays.com','huffingtonpost.co.uk','linuxconfig.org' ]
    # websites = websites[:22]
    isTest = False
    n = 25
    portNums = [50001 + i for i in range(n)]
    processes = []
    for i in range(n):
        p = multiprocessing.Process(target=crawl, args=(websites[i::n], portNums[i], isTest))
        processes.append(p)
        p.start()
    for p in processes:
        p.join()
        
        
def testfn():
    dir = './../data_modified'
    # check how many .db files
    f = [x for x in os.listdir(dir) if x.endswith('.db')]
    # extract the website names
    websites = [x.split('.')[0] for x in f]
    # delete the files in f and the folders in websites
    for file in f:
        os.remove(os.path.join(dir, file))
    for website in websites:
        if os.path.exists(os.path.join(dir, website)):
            os.rmdir(os.path.join(dir, website)) 
    
    # now explore each folder in the directory and determine if each folder has 2 files. add the name of the website to a list if it does
    a = []
    for folder in os.listdir(dir):
        if os.path.isdir(os.path.join(dir, folder)):
            if len(os.listdir(os.path.join(dir, folder))) == 2:
                a.append(folder)
    print(len(a))
    return a



if __name__ == "__main__":
    # cleanup()
    # testfn()
    # crawlSetup()
    websites = ['gsmarena.com']
    # crawl(['republicworld.com'], 50001, False)
    crawl(websites, 50001, False)
    
    
    
